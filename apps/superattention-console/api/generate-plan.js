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

function parsePriceNumber(price) {
  if (price == null) return 0;
  const cleaned = String(price).replace(/,/g, "").match(/[0-9]+(\.[0-9]+)?/);
  return cleaned ? Number(cleaned[0]) : 0;
}

function allowedExperimentTypes(channels = []) {
  const allowed = new Set();
  for (const ch of channels) {
    const c = String(ch).toLowerCase();
    if (c.includes("reel")) allowed.add("reel");
    if (c.includes("whatsapp")) allowed.add("whatsapp");
    if (c.includes("website")) allowed.add("website");
    if (c.includes("linkedin")) allowed.add("linkedin");
    if (c.includes("email")) allowed.add("email");
  }
  return allowed;
}

function normalizeExperimentType(type = "") {
  const t = String(type).toLowerCase();
  if (t.includes("reel")) return "reel";
  if (t.includes("whatsapp")) return "whatsapp";
  if (t.includes("website")) return "website";
  if (t.includes("linkedin")) return "linkedin";
  if (t.includes("email")) return "email";
  if (t.includes("offer")) return "offer";
  return t;
}

function isEmptyField(value) {
  const t = (value || "").trim();
  return !t || t === "—" || t === "-";
}

function enrichWhatsappPack(wa, input, weekIndex) {
  const area = input.deliveryArea || input.whereLive || "your delivery area";
  const price = input.price || "";
  const product = input.product || "product";
  const promo = input.promoHook || "";
  const bundle = input.productBundle || input.offer || product;
  const baseMessage =
    wa.message ||
    `Hi! I make ${bundle} at ${price}. ${promo ? `${promo}. ` : ""}Reply YES if you want to order in ${area}.`;

  return {
    title: wa.title || `Week ${weekIndex + 1} broadcast`,
    message: baseMessage,
    photoBrief:
      wa.photoBrief ||
      `1 clear photo: ${product} jar, natural light, optional plate of food. No text on image.`,
    whoToMessage:
      wa.whoToMessage ||
      `20–30 warm contacts in ${area} (friends, neighbours, past buyers)`,
    sendTime: wa.sendTime || "Tue or Wed, 7–9pm",
    replyScript:
      wa.replyScript ||
      `If price: remind ${price} and ${promo || "quality"}. If trust: offer founder delivery.`,
    metric: wa.metric || "Reply rate and orders placed",
  };
}

function enrichReelExperiment(exp, reel, input) {
  const hook = reel?.hook || reel?.script || "";
  return {
    ...exp,
    type: exp.type || "Reel",
    why: isEmptyField(exp.why)
      ? `Reels build trust with ${(input.audience || "your buyer").slice(0, 60)}.`
      : exp.why,
    action: isEmptyField(exp.action)
      ? hook
        ? `Film 30s Reel: ${hook}`
        : `Film 30s Reel featuring ${input.product} — hook in first 3 seconds.`
      : exp.action,
    cta: isEmptyField(exp.cta) ? reel?.cta || input.promoHook || "Order on WhatsApp" : exp.cta,
    metric: isEmptyField(exp.metric) ? "Saves and WhatsApp DMs" : exp.metric,
    decisionRule: isEmptyField(exp.decisionRule)
      ? "If 3+ saves or DMs, repeat this hook style next week."
      : exp.decisionRule,
  };
}

function enrichWhatsappExperiment(exp, waPack, input) {
  return {
    ...exp,
    type: exp.type || "WhatsApp",
    why: isEmptyField(exp.why) ? "Warm contacts convert faster than cold outreach." : exp.why,
    action: isEmptyField(exp.action)
      ? `Send the exact message below to: ${waPack.whoToMessage}`
      : exp.action,
    message: exp.message || waPack.message,
    photoBrief: exp.photoBrief || waPack.photoBrief,
    whoToMessage: exp.whoToMessage || waPack.whoToMessage,
    sendTime: exp.sendTime || waPack.sendTime,
    replyScript: exp.replyScript || waPack.replyScript,
    cta: isEmptyField(exp.cta) ? waPack.message.slice(0, 100) : exp.cta,
    metric: isEmptyField(exp.metric) ? waPack.metric : exp.metric,
    decisionRule: isEmptyField(exp.decisionRule)
      ? "Under 2 replies? Send a personal voice note on day 3."
      : exp.decisionRule,
  };
}

function normalizePlan(plan, input) {
  if (!plan || typeof plan !== "object") return plan;
  const allowed = allowedExperimentTypes(input.channels || []);
  const reels = plan.contentAssets?.reels || [];
  let whatsapp = (plan.contentAssets?.whatsapp || []).map((wa, i) => enrichWhatsappPack(wa, input, i));

  if (!plan.contentAssets) plan.contentAssets = {};
  plan.contentAssets.whatsapp = whatsapp;
  if (!allowed.has("website")) plan.contentAssets.website = [];
  if (!allowed.has("linkedin")) plan.contentAssets.linkedin = [];
  if (!allowed.has("reel")) plan.contentAssets.reels = [];
  if (!allowed.has("whatsapp")) plan.contentAssets.whatsapp = [];

  const priceNum = parsePriceNumber(input.price);
  if (priceNum && plan.contentAssets.whatsapp) {
    plan.contentAssets.whatsapp = plan.contentAssets.whatsapp.map((wa) => {
      let message = wa.message || "";
      const wrongPrices = message.match(/Rs\.?\s*[\d,]+/gi) || [];
      for (const match of wrongPrices) {
        const n = parsePriceNumber(match);
        if (n && n !== priceNum) {
          message = message.replace(match, input.price);
        }
      }
      return { ...wa, message };
    });
  }

  plan.weeklyPlan = (plan.weeklyPlan || []).map((week, weekIndex) => {
    const waPack = enrichWhatsappPack(whatsapp[weekIndex] || whatsapp[0] || {}, input, weekIndex);
    const reelAsset = reels[weekIndex] || reels[weekIndex % Math.max(reels.length, 1)] || {};

    let experiments = (week.experiments || [])
      .map((exp) => {
        const kind = normalizeExperimentType(exp.type);
        if (kind === "reel") return enrichReelExperiment(exp, reelAsset, input);
        if (kind === "whatsapp") return enrichWhatsappExperiment(exp, waPack, input);
        return exp;
      })
      .filter((exp) => {
        const kind = normalizeExperimentType(exp.type);
        if (kind === "offer") return true;
        return allowed.has(kind);
      });

    if (allowed.has("whatsapp") && !experiments.some((e) => normalizeExperimentType(e.type) === "whatsapp")) {
      experiments.push(enrichWhatsappExperiment({ type: "WhatsApp", title: waPack.title }, waPack, input));
    }
    if (allowed.has("reel") && !experiments.some((e) => normalizeExperimentType(e.type) === "reel")) {
      experiments.push(enrichReelExperiment({ type: "Reel", title: reelAsset.title || "Reel" }, reelAsset, input));
    }

    return { ...week, experiments: experiments.slice(0, 2) };
  });

  return plan;
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

  const channelList = (input.channels || []).map((channel) => `- ${channel}`).join("\n");
  const onlyTheseChannels = `
CHANNEL RULE (mandatory):
- Generate experiments and contentAssets ONLY for these selected channels:
${channelList}
- Do NOT add Email, LinkedIn, or Website content if not listed above.
- Each week MUST have complete Reel AND WhatsApp experiments if both are selected — every field filled (why, action, cta, metric, decisionRule). Never leave why or action empty.
`;

  const priceLock = `
PRICE LOCK (mandatory):
- Product price is EXACTLY ${input.price}. Never invent a different price, weight, or jar size.
- Use product bundle exactly: ${productBundle}
`;

  return `
You are superattention.ai, an AI growth coach for early Indian D2C brands.

Turn attention into revenue. Be specific, practical, and honest about what a solo founder can execute.

Brand:
- Name: ${input.brandName}
- Category: ${input.category}
- Current monthly revenue: ${input.currentRevenue}
- Revenue goal (active): ${input.revenueGoal}
- Founder entered stretch: ${input.stretchGoal || input.revenueGoal}
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
${channelList}
${channelLimit}
${onlyTheseChannels}
${priceLock}
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
          "type": "Reel or WhatsApp only",
          "title": "short title",
          "why": "why this experiment matters — REQUIRED non-empty",
          "action": "what founder should do — REQUIRED non-empty",
          "cta": "exact CTA",
          "metric": "main metric",
          "decisionRule": "what to do based on result",
          "message": "for WhatsApp only: exact copy-paste message",
          "photoBrief": "for WhatsApp only: what photo to attach",
          "whoToMessage": "for WhatsApp only: who to message",
          "sendTime": "for WhatsApp only: best send time",
          "replyScript": "for WhatsApp only: 1-line reply if they hesitate"
        }
      ]
    }
  ],
  "contentAssets": {
    "reels": [{"title": "title", "hook": "hook", "script": "short script", "cta": "cta"}],
    "whatsapp": [{"title": "title", "message": "exact copy-paste broadcast", "photoBrief": "photo instructions", "whoToMessage": "who to message", "sendTime": "when to send", "replyScript": "reply if they hesitate", "metric": "success metric"}],
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

      return normalizePlan(parsePlanJson(text), input);
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
module.exports.normalizePlan = normalizePlan;
