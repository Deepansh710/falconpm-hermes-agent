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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action, input, answers, findings, checklist } = body;

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
