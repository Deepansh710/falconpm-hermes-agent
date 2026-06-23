const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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

function formatCapacity(input) {
  if (input.contentCapacity) return input.contentCapacity;
  const parts = [];
  if (input.reelsPerWeek != null) parts.push(`${input.reelsPerWeek} Reels/week`);
  if (input.whatsappBroadcasts === "yes") parts.push("WhatsApp broadcasts");
  if (input.storiesPerWeek === "yes") parts.push("Instagram Stories");
  if (input.onCamera === "no") parts.push("not comfortable on camera");
  if (input.hoursPerWeek) parts.push(`~${input.hoursPerWeek} hrs/week`);
  return parts.join(", ") || "not specified";
}

function buildPrompt(input, priorLearnings = null) {
  const productBundle = input.productBundle || input.offer || "";
  const promoHook = input.promoHook || "";
  const hesitation = input.hesitationLabel || input.audienceHesitation || "";
  const capacity = formatCapacity(input);

  const learningsBlock = priorLearnings
    ? `
Prior closed campaign learnings (use these to improve this plan):
- Best hook: ${priorLearnings.bestHook || "n/a"}
- Top objection: ${priorLearnings.topObjection || "n/a"}
- Repeat next time: ${priorLearnings.repeat || "n/a"}
- Stop doing: ${priorLearnings.stop || "n/a"}
- Final revenue: Rs. ${priorLearnings.finalRevenue ?? "n/a"}
- Final orders: ${priorLearnings.finalOrders ?? "n/a"}
`
    : "";

  const phasedBlock = input.usePhasedPlan
    ? `
Goal mode: STRETCH — founder chose an aggressive target. Structure the plan in two phases:
- Phase 1 (Weeks 1-2): realistic proof — repeat orders, WhatsApp conversion, one strong Reel hook.
- Phase 2 (Weeks 3-4): scale what worked toward stretch goal ${input.revenueGoal}.
Mention Phase 1 and Phase 2 explicitly in weekly themes.
`
    : input.goalChoice === "recommended"
      ? `
Goal mode: RECOMMENDED — use the recommended revenue target as primaryGoal in summary (${input.recommendedGoal || input.revenueGoal}).
`
      : "";

  const channelLimit =
    input.brandStage?.includes("First sales") || input.brandStage?.includes("Idea")
      ? "Use at most 2 channels. Prefer Instagram Reels + WhatsApp campaign for early food D2C."
      : "";

  return `
You are superattention.ai, an AI growth coach for early Indian D2C brands.

Turn attention into revenue. Be specific, practical, and honest about what a solo founder can execute.

Brand:
- Name: ${input.brandName}
- Category: ${input.category}
- Current monthly revenue: ${input.currentRevenue}
- Revenue goal: ${input.revenueGoal}
- Recommended goal: ${input.recommendedGoal || "same as revenue goal"}
- Brand tone: ${input.brandTone}
- Brand stage: ${input.brandStage || "not specified"}

Brand story:
- Why this brand exists: ${input.brandMission || "not specified"}
- What makes it different: ${input.brandDifferentiation || "not specified"}
- What did not work last time: ${input.pastFailures || "none shared"}

Product / offer:
- Product: ${input.product}
- Price: ${input.price}
- Product bundle (what they get): ${productBundle}
- Promo hook (why order now): ${promoHook || "none"}

Audience and market:
- Target customer: ${input.audience}
- Main hesitation: ${hesitation || "see audience text"}
- Delivery area: ${input.deliveryArea}
- Order channel: ${input.orderChannel}
- Content capacity: ${capacity}

Channels to use:
${input.channels.map((channel) => `- ${channel}`).join("\n")}
${channelLimit}
${phasedBlock}
${learningsBlock}

CONTENT RULES (mandatory):
- Promo hook "${promoHook}" MUST appear in every WhatsApp message and at least one Reel CTA (if promo hook is not empty).
- Address hesitation "${hesitation}" in at least one Reel hook and one WhatsApp message.
- Respect content capacity — do not assign more Reels than founder can shoot.

Return ONLY valid JSON. Do not wrap it in markdown. Do not include commentary before or after JSON.

Use this exact structure:
{
  "summary": {
    "positioning": "one sharp campaign positioning sentence",
    "primaryGoal": "revenue goal",
    "unitTarget": "estimated units/orders needed",
    "coreInsight": "most important customer insight",
    "primaryChannel": "highest leverage channel",
    "risk": "biggest risk to watch"
  },
  "diagnosis": [
    {"label": "What is working", "detail": "specific diagnosis"},
    {"label": "What is broken", "detail": "specific diagnosis"},
    {"label": "Growth lever", "detail": "specific diagnosis"}
  ],
  "weeklyPlan": [
    {
      "week": "Week 1",
      "theme": "theme name",
      "target": "weekly target",
      "objective": "plain-English objective",
      "experiments": [
        {
          "type": "Reel / WhatsApp / Website / Offer / LinkedIn",
          "title": "short title",
          "why": "why this experiment matters",
          "action": "what founder should do",
          "cta": "exact CTA",
          "metric": "main metric",
          "decisionRule": "what to do based on result"
        }
      ]
    }
  ],
  "contentAssets": {
    "reels": [{"title": "title", "hook": "hook", "script": "short script", "cta": "cta"}],
    "whatsapp": [{"title": "title", "message": "message"}],
    "website": [{"title": "title", "copy": "copy"}],
    "linkedin": [{"title": "title", "post": "post"}]
  },
  "metrics": [
    {"name": "metric", "why": "why it matters", "target": "target"}
  ],
  "nextActions": [
    "specific action for the next 7 days"
  ]
}

Constraints (critical for valid JSON output):
- Exactly 4 weeks in weeklyPlan.
- Max 2 experiments per week.
- Max 2 items per contentAssets channel (reels, whatsapp, website, linkedin).
- Max 3 nextActions.
- Keep every string under 120 characters. No newlines inside JSON strings.
- Escape quotes inside strings with backslash.
- Do not truncate — if running long, shorten copy instead of cutting JSON mid-string.
`.trim();
}

function extractJsonText(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return raw;
  }
  return raw.slice(start, end + 1);
}

function repairTruncatedJson(text) {
  let repaired = text.trim();
  if (repaired.endsWith(",")) {
    repaired = repaired.slice(0, -1);
  }

  const stack = [];
  let inString = false;
  let escaped = false;

  for (const char of repaired) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") stack.push("}");
    if (char === "[") stack.push("]");
    if (char === "}" || char === "]") stack.pop();
  }

  if (inString) {
    repaired += '"';
  }

  while (stack.length) {
    repaired += stack.pop();
  }

  return repaired;
}

function parsePlanJson(text) {
  const cleaned = extractJsonText(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const repaired = repairTruncatedJson(cleaned);
    return JSON.parse(repaired);
  }
}

async function requestAnthropic({ model, maxTokens, prompt }) {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || "Anthropic request failed";
    throw new Error(message);
  }

  const text = data.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");

  if (!text) {
    throw new Error("Anthropic returned an empty response");
  }

  return { text, stopReason: data.stop_reason };
}

async function fetchLastClosedLearnings(brandName) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = tableName();

  if (!supabaseUrl || !serviceRoleKey || !brandName) {
    return null;
  }

  const quotedBrand = `"${String(brandName).replace(/"/g, '\\"')}"`;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?brand_name=eq.${encodeURIComponent(quotedBrand)}&select=metrics,created_at&order=created_at.desc&limit=10`,
    {
      headers: supabaseHeaders(serviceRoleKey),
    },
  );

  const rows = await response.json();
  if (!response.ok || !Array.isArray(rows)) {
    return null;
  }

  const closed = rows.find((row) => row.metrics?.status === "closed");
  if (!closed?.metrics?.learnings) {
    return null;
  }

  const { learnings, tracker } = closed.metrics;
  return {
    ...learnings,
    finalRevenue: tracker?.revenue,
    finalOrders: tracker?.orders,
  };
}

async function pauseLiveCampaignsForBrand(brandName) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = tableName();

  if (!supabaseUrl || !serviceRoleKey || !brandName) return;

  const quotedBrand = `"${String(brandName).replace(/"/g, '\\"')}"`;
  const listRes = await fetch(
    `${supabaseUrl}/rest/v1/${table}?brand_name=eq.${encodeURIComponent(quotedBrand)}&select=id,metrics&order=created_at.desc&limit=20`,
    { headers: supabaseHeaders(serviceRoleKey) },
  );
  const rows = await listRes.json();
  if (!listRes.ok || !Array.isArray(rows)) return;

  const liveRows = rows.filter((row) => row.metrics?.status === "live");
  await Promise.all(
    liveRows.map((row) =>
      fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${row.id}`, {
        method: "PATCH",
        headers: supabaseHeaders(serviceRoleKey, {
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          metrics: {
            ...row.metrics,
            status: "paused",
            pausedAt: new Date().toISOString(),
            pausedReason: "new_campaign_generated",
          },
        }),
      }),
    ),
  );
}

async function callAnthropic(input, priorLearnings) {
  const model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";
  const requested = Number(process.env.ANTHROPIC_MAX_TOKENS || 8192);
  const maxTokens = model.includes("haiku")
    ? Math.min(requested, 4096)
    : Math.min(requested, 8192);
  const prompt = buildPrompt(input, priorLearnings);

  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryPrompt =
      attempt === 0
        ? prompt
        : `${prompt}

Your previous response was truncated or invalid JSON. Return the same plan again as COMPLETE valid JSON only. Use shorter strings.`;

    try {
      const { text, stopReason } = await requestAnthropic({
        model,
        maxTokens,
        prompt: retryPrompt,
      });

      if (stopReason === "max_tokens") {
        throw new Error("Response hit token limit before JSON completed");
      }

      return parsePlanJson(text);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError?.message?.includes("JSON")
      ? `AI returned invalid JSON after retry: ${lastError.message}`
      : lastError?.message || "Failed to parse AI plan",
  );
}

async function saveCampaign(input, plan) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = tableName();

  if (!supabaseUrl || !serviceRoleKey) {
    return { saved: false, reason: "Supabase environment variables not configured" };
  }

  await pauseLiveCampaignsForBrand(input.brandName);

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey, {
      "content-type": "application/json",
      prefer: "return=representation",
    }),
    body: JSON.stringify({
      brand_name: input.brandName,
      product: input.product,
      goal: input.revenueGoal,
      audience: input.audience,
      channels: input.channels,
      delivery_area: input.deliveryArea,
      content_capacity: formatCapacity(input),
      plan_text: JSON.stringify(plan, null, 2),
      input_payload: input,
      metrics: { status: "live" },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Failed to save campaign to Supabase");
  }

  return { saved: true, campaign: data[0] };
}

function validateInput(input) {
  const required = [
    "brandName",
    "category",
    "product",
    "price",
    "audience",
    "revenueGoal",
    "orderChannel",
    "deliveryArea",
    "brandTone",
    "currentRevenue",
    "brandMission",
    "brandDifferentiation",
    "brandStage",
  ];

  for (const field of required) {
    if (!input[field] || typeof input[field] !== "string") {
      return `${field} is required`;
    }
  }

  const bundle = input.productBundle || input.offer;
  if (!bundle || typeof bundle !== "string") {
    return "productBundle is required";
  }

  if (!Array.isArray(input.channels) || input.channels.length === 0) {
    return "At least one growth channel is required";
  }

  if (input.discoveryMode && !input.discoveryOverride) {
    return "Complete Discovery Week or use override before generating full plan";
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const validationError = validateInput(input);

    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const priorLearnings = await fetchLastClosedLearnings(input.brandName);
    const plan = await callAnthropic(input, priorLearnings);
    const saveResult = await saveCampaign(input, plan);

    return json(res, 200, {
      plan,
      saveResult,
      usedPriorLearnings: Boolean(priorLearnings),
    });
  } catch (error) {
    return json(res, 500, {
      error: error.message || "Failed to generate plan",
    });
  }
};

// Export for tests
module.exports.buildPrompt = buildPrompt;
module.exports.validateInput = validateInput;
