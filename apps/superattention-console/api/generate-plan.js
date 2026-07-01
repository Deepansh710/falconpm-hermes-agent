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
  const brand = input.brandName || "our brand";
  const channel = (input.orderChannel || "").toLowerCase();
  const isCod = channel.includes("cod");
  const paymentLine = isCod
    ? `Cash on delivery when we deliver to ${area}.`
    : `Please UPI ${price} before dispatch and send payment screenshot here.`;
  const ops = {
    contactListGuide: `Week 1: message 20–30 warm contacts in ${area}. Week 2+: add 10–15 warm leads only.`,
    replyYesScript: `Thanks! Order: ${bundle} at ${price}. ${paymentLine} Share full address + delivery day.`,
    orderConfirmScript: `Order confirmed — delivery on [DAY]. ${isCod ? "COD ready." : "Payment received."}`,
    deliveryScript: `Your ${product} is out for delivery today between [TIME]. Reply to reschedule.`,
    objectionPrice: `Fair question — ${price} for ${bundle}. ${promo ? `${promo}. ` : ""}Small-batch quality.`,
    objectionTrust: `${brand} is founder-run — I deliver in ${area} myself.`,
    objectionOily: `Less oil than typical market pickles — worth one try.`,
  };
  const hesitation = (input.hesitationLabel || input.hesitation || "").toLowerCase();
  let replyScript = wa.replyScript;
  if (!replyScript) {
    if (hesitation.includes("price")) replyScript = ops.objectionPrice;
    else if (hesitation.includes("trust") || hesitation.includes("unknown")) replyScript = ops.objectionTrust;
    else if (hesitation.includes("oily") || hesitation.includes("taste")) replyScript = ops.objectionOily;
    else replyScript = `If price: remind ${price}. If trust: offer founder delivery in ${area}.`;
  }
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
    replyScript,
    contactListGuide: wa.contactListGuide || ops.contactListGuide,
    replyYesScript: wa.replyYesScript || ops.replyYesScript,
    orderConfirmScript: wa.orderConfirmScript || ops.orderConfirmScript,
    deliveryScript: wa.deliveryScript || ops.deliveryScript,
    objectionPrice: wa.objectionPrice || ops.objectionPrice,
    objectionTrust: wa.objectionTrust || ops.objectionTrust,
    objectionOily: wa.objectionOily || ops.objectionOily,
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
    contactListGuide: exp.contactListGuide || waPack.contactListGuide,
    replyYesScript: exp.replyYesScript || waPack.replyYesScript,
    orderConfirmScript: exp.orderConfirmScript || waPack.orderConfirmScript,
    deliveryScript: exp.deliveryScript || waPack.deliveryScript,
    objectionPrice: exp.objectionPrice || waPack.objectionPrice,
    objectionTrust: exp.objectionTrust || waPack.objectionTrust,
    objectionOily: exp.objectionOily || waPack.objectionOily,
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
- Best message: ${priorLearnings.bestMessage || priorLearnings.bestHook || "n/a"}
- Best creative: ${priorLearnings.bestCreative || "n/a"}
- Best channel: ${priorLearnings.bestChannel || "n/a"}
- Best offer: ${priorLearnings.bestOffer || "n/a"}
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

  const capacityBlock = input.capacityNote
    ? `
CAPACITY CONSTRAINT (mandatory):
- Founder capacity: ${capacity}
- Risk note: ${input.capacityNote}
- Do NOT assign more weekly orders, Reels, or broadcasts than this founder can execute solo.
- Prefer fewer, higher-quality WhatsApp follow-ups over scaling content volume.
`
    : `
CAPACITY CONSTRAINT:
- Respect content capacity: ${capacity}. Do not exceed Reels/week or marketing hours stated.
`;

  const scopeLine =
    input.campaignScope === "whole_brand"
      ? "Campaign scope: whole brand (multiple products)."
      : `Campaign scope: single hero SKU — ${input.product}.`;

  return `
You are superattention.ai, an AI growth coach for early Indian D2C brands.

Turn attention into revenue. Be specific, practical, and honest about what a solo founder can execute.

Brand:
- Name: ${input.brandName}
- Category: ${input.category}
- ${scopeLine}
- Current monthly revenue: ${input.currentRevenue}
- Revenue goal (active): ${input.revenueGoal}
- North-star metric: ${input.northStarMetric || "orders"}
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
${capacityBlock}
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
          "replyScript": "for WhatsApp only: 1-line reply if they hesitate",
          "contactListGuide": "for WhatsApp only: warm vs cold list guidance",
          "replyYesScript": "for WhatsApp only: reply when they say YES",
          "orderConfirmScript": "for WhatsApp only: after payment/COD confirm",
          "deliveryScript": "for WhatsApp only: delivery day message"
        }
      ]
    }
  ],
  "contentAssets": {
    "reels": [{"title": "title", "hook": "hook", "script": "short script", "cta": "cta"}],
    "whatsapp": [{"title": "title", "message": "exact copy-paste broadcast", "photoBrief": "photo instructions", "whoToMessage": "who to message", "sendTime": "when to send", "replyScript": "reply if they hesitate", "contactListGuide": "list guidance", "replyYesScript": "YES reply", "orderConfirmScript": "order confirm", "deliveryScript": "delivery msg", "objectionPrice": "price objection", "objectionTrust": "trust objection", "objectionOily": "oily objection", "metric": "success metric"}],
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
  if (start === -1) {
    return raw;
  }

  // Walk from the first "{" tracking brace/bracket depth (respecting strings
  // and escapes) to find where the top-level object actually closes. This
  // strips trailing prose after the JSON. If it never balances — a truncated
  // response — return through end-of-text so repairTruncatedJson can finish
  // it, rather than cutting at an inner "}" and dropping trailing keys.
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") depth += 1;
    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return raw.slice(start);
}

// Fix invalid escape sequences the model sometimes emits inside strings.
// JSON only allows \" \\ \/ \b \f \n \r \t \uXXXX. Anything else — most
// often \' around Hinglish apostrophes, a stray backslash, or a raw
// control char — makes JSON.parse throw "Bad escaped character".
function sanitizeJsonEscapes(text) {
  const VALID_ESCAPE = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);
  let out = "";
  let inString = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (!inString) {
      if (char === '"') inString = true;
      out += char;
      continue;
    }

    // inside a JSON string
    if (char === '"') {
      inString = false;
      out += char;
      continue;
    }

    if (char === "\\") {
      const next = text[i + 1];

      if (next === undefined) {
        out += "\\\\"; // trailing backslash -> literal backslash
        continue;
      }
      if (next === "u") {
        const hex = text.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += "\\u" + hex; // valid unicode escape
          i += 5;
        } else {
          out += "\\\\"; // malformed \u -> literal backslash
        }
        continue;
      }
      if (VALID_ESCAPE.has(next)) {
        out += "\\" + next; // already valid pair, keep as-is
        i += 1;
        continue;
      }
      if (next === "'") {
        out += "'"; // apostrophe never needs escaping in JSON
        i += 1;
        continue;
      }
      out += "\\\\"; // any other invalid escape -> literal backslash
      continue;
    }

    // raw control chars are illegal inside JSON strings — escape them
    if (char === "\n") { out += "\\n"; continue; }
    if (char === "\r") { out += "\\r"; continue; }
    if (char === "\t") { out += "\\t"; continue; }

    out += char;
  }

  return out;
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

  // 1. Fast path: already-valid JSON.
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Fix invalid escape sequences / raw control chars.
  const sanitized = sanitizeJsonEscapes(cleaned);
  try {
    return JSON.parse(sanitized);
  } catch {}

  // 3. Repair truncation on top of the sanitized text (handles the case
  //    where the response is BOTH truncated and has bad escapes).
  const repaired = repairTruncatedJson(sanitized);
  return JSON.parse(repaired);
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
      metrics: {
        status: "live",
        campaignStartedAt: new Date().toISOString(),
        northStarMetric: input.northStarMetric || "orders",
      },
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
      priorLearnings: priorLearnings || null,
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
module.exports.parsePlanJson = parsePlanJson;
module.exports.sanitizeJsonEscapes = sanitizeJsonEscapes;
module.exports.repairTruncatedJson = repairTruncatedJson;
