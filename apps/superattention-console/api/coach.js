const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function requestAnthropic(prompt, maxTokens = 2048) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";
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
    throw new Error(data?.error?.message || "Anthropic request failed");
  }

  return (
    data.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n\n") || ""
  );
}

function parseJsonResponse(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(raw.slice(start, end + 1));
  }
  return JSON.parse(raw);
}

function audienceDraftPrompt(input, answers) {
  return `You help first-time Indian D2C founders describe their customer in plain English.

Brand: ${input.brandName}
Product: ${input.product}
Category: ${input.category}
Area: ${input.deliveryArea || "not specified"}

Founder answers:
- Who buys: ${answers.whoBuys || "not sure"}
- Where they live: ${answers.whereLive || "not sure"}
- What they buy instead: ${answers.substitute || "not sure"}
- Main hesitation: ${answers.hesitation || "not sure"}
- How sure: ${answers.confidence || "not sure"}

Return ONLY valid JSON:
{
  "founderSummary": "2-3 sentences combining their raw words",
  "clearVersion": "2-4 sentences: who pays, where, what they buy instead, main hesitation — specific not generic",
  "hesitationLabel": "short label e.g. oily/trust/price"
}

No jargon. No markdown. Keep strings under 280 chars each.`;
}

function discoveryWeekPrompt(input) {
  return `You are a practical growth coach for an early Indian D2C founder who does NOT know their customer yet.

Brand: ${input.brandName}
Product: ${input.product}
Category: ${input.category}
Delivery area: ${input.deliveryArea || "local"}
Order channel: ${input.orderChannel || "WhatsApp"}

They cannot answer audience questions yet. Create a 1-week discovery checklist.

Return ONLY valid JSON:
{
  "intro": "2 sentences in plain English — it's normal not to know yet",
  "tasks": [
    {
      "day": "Day 1",
      "title": "short title",
      "action": "what to do in plain words",
      "script": "copy-paste WhatsApp or Instagram Story text they can use",
      "noteWhatToWrite": "one line what to note down after"
    }
  ],
  "interimWhatsapp": "short WhatsApp order template for discovery mode",
  "interimReelIdea": "one intro reel idea without hard sell"
}

Exactly 5 tasks. Tasks must be doable in Faridabad-style local D2C context. Keep strings under 200 chars.`;
}

function discoverySynthesizePrompt(input, findings) {
  return `Turn discovery findings into a customer summary for a growth plan.

Brand: ${input.brandName}
Product: ${input.product}

Founder reported after 1 week:
- Who ordered/replied: ${findings.whoFound || ""}
- Areas: ${findings.areasFound || ""}
- Substitute: ${findings.substituteFound || ""}
- Top hesitation: ${findings.hesitationFound || ""}

Return ONLY valid JSON:
{
  "audience": "2-4 sentence customer summary",
  "hesitationLabel": "price/trust/taste/oily/convenience/unknown",
  "confidenceNote": "one sentence on how solid this is"
}`;
}

function failureDebriefPrompt(input, checklist) {
  return `Structure a past failure note for a growth AI.

Brand: ${input.brandName}
Channel tried: ${checklist.channel || ""}
Content type: ${checklist.contentType || ""}
What happened: ${checklist.outcome || ""}
Stop doing: ${checklist.stopDoing || ""}

Return ONLY valid JSON:
{
  "pastFailures": "2 sentences: what failed and what to avoid next time",
  "lesson": "one short lesson for the founder"
}`;
}

function missionDraftPrompt(input, answers) {
  return `Help an Indian D2C founder write their brand mission in plain English.

Brand: ${input.brandName}
Product: ${input.product}
Category: ${input.category}

Founder answers:
- Why they started: ${answers.whyStarted || ""}
- Emotional moment: ${answers.emotionalMoment || ""}
- How customer should feel: ${answers.customerFeel || ""}

Return ONLY valid JSON:
{
  "founderSummary": "their words combined",
  "clearVersion": "2-3 sentences: why brand exists emotionally — specific not generic",
  "isSubstantive": true
}

If answers are empty or 'don't know', set isSubstantive false and clearVersion to empty string.
Keep strings under 280 chars. No markdown.`;
}

function differentiationDraftPrompt(input, answers) {
  return `Help an Indian D2C founder state what makes them different.

Brand: ${input.brandName}
Product: ${input.product}

Founder answers:
- What they can prove: ${answers.provable || ""}
- What customers say: ${answers.customerSays || ""}
- Competitors cannot copy: ${answers.cannotCopy || ""}

Return ONLY valid JSON:
{
  "founderSummary": "bullets combined",
  "clearVersion": "2-3 sentences of real differentiation — no generic claims"
}`;
}

function offerDraftPrompt(input, answers) {
  return `Help an Indian D2C founder describe product bundle and promo hook.

Brand: ${input.brandName}
Product: ${input.product}
Price: ${input.price}

Founder answers:
- What's in the jar/box: ${answers.bundleDetail || ""}
- Size/variant: ${answers.sizeVariant || ""}
- Why order now: ${answers.promoWhy || ""}
- Promo type: ${answers.promoType || ""}

Return ONLY valid JSON:
{
  "productBundle": "what customer gets for the price",
  "promoHook": "delivery/discount/sample/urgency hook or empty",
  "founderSummary": "one line summary",
  "clearVersion": "bundle + promo in plain English for brief review"
}`;
}

function goalCoachPrompt(input, intel) {
  return `Write a plain-English goal coach note for an early Indian D2C founder.

Current monthly revenue: ${input.currentRevenue}
Stretch goal: ${input.revenueGoal}
Recommended goal: ${intel.recommendedGoalString || ""}
Brand stage: ${input.brandStage}
Orders needed: ${intel.ordersNeeded}
Orders per week: ${intel.ordersPerWeek}
Is aggressive: ${intel.isAggressive}
Is absurd: ${intel.isAbsurd}

Return ONLY valid JSON:
{
  "narrative": "3-4 short sentences: what recommended means, what stretch requires, what to focus on first (WhatsApp + Reels). Plain words.",
  "weeklyFocus": "one sentence on weekly order/WhatsApp target"
}`;
}

function closeDebriefPrompt(input, learnings) {
  return `Structure campaign close learnings for next growth plan.

Brand: ${input.brandName}
Best hook: ${learnings.bestHook || ""}
Top objection: ${learnings.topObjection || ""}
Repeat: ${learnings.repeat || ""}
Stop: ${learnings.stop || ""}
Final orders: ${learnings.finalOrders ?? ""}
Final revenue: ${learnings.finalRevenue ?? ""}

Return ONLY valid JSON:
{
  "summary": "2 sentences what worked and what to change",
  "bestHook": "refined best hook",
  "topObjection": "refined objection",
  "repeat": "what to repeat",
  "stop": "what to stop"
}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action, input, answers, findings, checklist, learnings, intel } = body;

    if (!action) {
      return json(res, 400, { error: "action is required" });
    }

    let text;
    let result;

    switch (action) {
      case "audience_draft": {
        text = await requestAnthropic(audienceDraftPrompt(input, answers || {}));
        result = parseJsonResponse(text);
        break;
      }
      case "discovery_week": {
        text = await requestAnthropic(discoveryWeekPrompt(input));
        result = parseJsonResponse(text);
        break;
      }
      case "discovery_synthesize": {
        text = await requestAnthropic(discoverySynthesizePrompt(input, findings || {}));
        result = parseJsonResponse(text);
        break;
      }
      case "failure_debrief": {
        text = await requestAnthropic(failureDebriefPrompt(input, checklist || {}));
        result = parseJsonResponse(text);
        break;
      }
      case "mission_draft": {
        text = await requestAnthropic(missionDraftPrompt(input, answers || {}));
        result = parseJsonResponse(text);
        break;
      }
      case "differentiation_draft": {
        text = await requestAnthropic(differentiationDraftPrompt(input, answers || {}));
        result = parseJsonResponse(text);
        break;
      }
      case "offer_draft": {
        text = await requestAnthropic(offerDraftPrompt(input, answers || {}));
        result = parseJsonResponse(text);
        break;
      }
      case "goal_coach": {
        text = await requestAnthropic(goalCoachPrompt(input, intel || {}));
        result = parseJsonResponse(text);
        break;
      }
      case "close_debrief": {
        text = await requestAnthropic(closeDebriefPrompt(input, learnings || {}));
        result = parseJsonResponse(text);
        break;
      }
      default:
        return json(res, 400, { error: `Unknown action: ${action}` });
    }

    return json(res, 200, { result });
  } catch (error) {
    return json(res, 500, {
      error: error.message || "Coach request failed",
    });
  }
};
