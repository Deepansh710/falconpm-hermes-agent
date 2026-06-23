function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function tableName() {
  return process.env.SUPABASE_CAMPAIGNS_TABLE || "campaigns";
}

function supabaseHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    ...extra,
  };
}

function campaignStatus(metrics) {
  if (metrics && typeof metrics === "object" && metrics.status) {
    return metrics.status;
  }
  return "live";
}

async function listCampaigns() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = tableName();

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      campaigns: [],
      configured: false,
      reason: "Supabase environment variables not configured",
    };
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=id,created_at,brand_name,product,goal,audience,channels,plan_text,input_payload,metrics&order=created_at.desc&limit=20`,
    {
      headers: supabaseHeaders(serviceRoleKey),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to fetch campaigns from Supabase");
  }

  return {
    campaigns: data.map((row) => ({
      ...row,
      status: campaignStatus(row.metrics),
    })),
    configured: true,
  };
}

async function patchCampaign(id, metricsPatch) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = tableName();

  const getRes = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}&select=metrics`, {
    headers: supabaseHeaders(serviceRoleKey),
  });
  const rows = await getRes.json();
  if (!getRes.ok) {
    throw new Error(rows?.message || "Failed to load campaign");
  }

  const existing = rows[0]?.metrics || {};
  const metrics = { ...existing, ...metricsPatch };

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: supabaseHeaders(serviceRoleKey, {
      "content-type": "application/json",
      prefer: "return=representation",
    }),
    body: JSON.stringify({ metrics }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "Failed to update campaign");
  }

  return { campaign: data[0] };
}

async function closeCampaign(body) {
  const { id, tracker, learnings } = body;
  if (!id) throw new Error("Campaign id is required");

  return patchCampaign(id, {
    status: "closed",
    closedAt: new Date().toISOString(),
    tracker: tracker || {},
    learnings: learnings || {},
  });
}

async function saveCampaignProgress(body) {
  const { id, tracker, experimentProgress, manualWeek } = body;
  if (!id) throw new Error("Campaign id is required");

  const patch = {
    tracker: tracker || {},
    trackerUpdatedAt: new Date().toISOString(),
  };
  if (experimentProgress && typeof experimentProgress === "object") {
    patch.experimentProgress = experimentProgress;
  }
  if (manualWeek != null) patch.manualWeek = manualWeek;

  return patchCampaign(id, patch);
}

async function updateStatus(body) {
  const { id, status } = body;
  if (!id) throw new Error("Campaign id is required");
  if (!["live", "paused", "closed"].includes(status)) {
    throw new Error("status must be live, paused, or closed");
  }

  const patch = { status };
  if (status === "paused") patch.pausedAt = new Date().toISOString();
  if (status === "live") patch.resumedAt = new Date().toISOString();

  return patchCampaign(id, patch);
}

async function deleteCampaign(id) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = tableName();

  if (!id) throw new Error("Campaign id is required");

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers: supabaseHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data?.message || "Failed to delete campaign");
  }

  return { deleted: true, id };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await listCampaigns();
      return json(res, 200, result);
    }

    if (req.method === "PATCH") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      if (body.action === "save_progress") {
        const result = await saveCampaignProgress(body);
        return json(res, 200, result);
      }

      if (body.action === "close" || body.learnings != null) {
        const result = await closeCampaign(body);
        return json(res, 200, result);
      }

      const result = await updateStatus(body);
      return json(res, 200, result);
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url, "http://localhost");
      const id = url.searchParams.get("id");
      const result = await deleteCampaign(id);
      return json(res, 200, result);
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, {
      error: error.message || "Campaign request failed",
    });
  }
};
