// AI assist for the brand onboarding fields (1-4).
//
// Each field has its own system + user prompt per the product spec. Uses
// claude-sonnet-4-6 explicitly (not the env default) and returns only the
// generated text so the client can drop it straight into the field.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function cat(category) {
  const c = String(category || "").trim();
  return c || "not specified";
}

// Returns { system, user, maxTokens } for the requested field, or null.
function buildPrompt(field, ctx) {
  const brandName = String(ctx.brandName || "").trim() || "the brand";
  const category = cat(ctx.category);
  const notes = String(ctx.notes || "").trim();
  const whyStarted = String(ctx.whyStarted || "").trim();
  const mission = String(ctx.mission || "").trim();

  switch (String(field)) {
    case "1":
      return {
        maxTokens: 1000,
        system:
          "You help D2C founders articulate their brand origin story in 2-3 sentences. First person, warm and human. No corporate language. Return only the story.",
        user: `Here are my rough notes: ${notes}. Write my brand origin story.`,
      };
    case "2":
      return {
        maxTokens: 1000,
        system:
          "You help D2C founders write a clear brand mission in 2-3 sentences. Simple words, no jargon. Return only the mission statement.",
        user: `Brand name: ${brandName}. Category: ${category}. Why they started: ${whyStarted}. Write their mission statement.`,
      };
    case "3":
      return {
        maxTokens: 500,
        system:
          "You help D2C founders identify the key moment their product creates value. One sentence, specific and vivid. Return only the sentence.",
        user: `Brand: ${brandName}. Category: ${category}. Describe the moment their product makes someone's day better.`,
      };
    case "4":
      return {
        maxTokens: 500,
        system:
          "You help D2C founders articulate the emotional experience of their brand. One vivid sentence. Return only the sentence.",
        user: `Brand: ${brandName}. Category: ${category}. Mission: ${mission}. How should a customer feel after their first order?`,
      };
    default:
      return null;
  }
}

async function requestAnthropic({ system, user, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
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
      .join("\n\n")
      .trim() || ""
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const prompt = buildPrompt(body.field, body);

    if (!prompt) {
      return json(res, 400, { error: "Unknown assist field" });
    }

    const text = await requestAnthropic(prompt);
    return json(res, 200, { text });
  } catch (error) {
    return json(res, 500, { error: error.message || "Brand assist failed" });
  }
};
