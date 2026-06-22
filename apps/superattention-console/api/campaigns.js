function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function listCampaigns() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_CAMPAIGNS_TABLE || "campaigns";

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      campaigns: [],
      configured: false,
      reason: "Supabase environment variables not configured",
    };
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=id,created_at,brand_name,product,goal,audience,channels,plan_text&order=created_at.desc&limit=10`,
    {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to fetch campaigns from Supabase");
  }

  return {
    campaigns: data,
    configured: true,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const result = await listCampaigns();
    return json(res, 200, result);
  } catch (error) {
    return json(res, 500, {
      error: error.message || "Failed to fetch campaigns",
    });
  }
};
