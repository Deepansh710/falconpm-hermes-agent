// Brand read + one-time onboarding save for superattention_brands.
//
// V1 is single-brand (no auth), so GET returns the most recent brand row and
// the client decides whether onboarding is needed (why_started empty). POST
// upserts the six onboarding fields keyed on the unique `name` column.

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function brandsTableName() {
  return process.env.SUPABASE_BRANDS_TABLE || "superattention_brands";
}

function supabaseHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    ...extra,
  };
}

async function fetchLatestBrand() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = brandsTableName();

  if (!supabaseUrl || !serviceRoleKey) {
    return { configured: false, brand: null };
  }

  const select =
    "id,name,category,why_started,mission,day_better_moment,customer_feeling,brand_tone,brand_stage";
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=${select}&order=created_at.desc&limit=1`,
    { headers: supabaseHeaders(serviceRoleKey) },
  );

  const rows = await response.json();
  if (!response.ok || !Array.isArray(rows)) {
    throw new Error(rows?.message || "Failed to fetch brand from Supabase");
  }

  return { configured: true, brand: rows[0] || null };
}

async function saveOnboarding(body) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = brandsTableName();

  if (!supabaseUrl || !serviceRoleKey) {
    return { saved: false, reason: "Supabase environment variables not configured" };
  }

  const name = String(body.name || "").trim();
  if (!name) throw new Error("Brand name is required to save onboarding");

  const row = {
    name,
    why_started: body.why_started,
    mission: body.mission,
    day_better_moment: body.day_better_moment,
    customer_feeling: body.customer_feeling,
    brand_tone: body.brand_tone,
    brand_stage: body.brand_stage,
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=name`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey, {
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(row),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "Failed to save brand onboarding to Supabase");
  }

  return { saved: true, brand: Array.isArray(data) ? data[0] : data };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await fetchLatestBrand();
      return json(res, 200, result);
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const result = await saveOnboarding(body);
      return json(res, 200, result);
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Brand request failed" });
  }
};
