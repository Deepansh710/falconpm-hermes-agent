// AI assist for the Edge step's differentiation statement.
// claude-sonnet-4-6, exact system/user prompt per spec. Returns only the text.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
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
    const product = String(body.product || "").trim() || "the product";
    const whatCanProve = String(body.whatCanProve || "").trim() || "not specified";
    const competitorsCantCopy = String(body.competitorsCantCopy || "").trim() || "not specified";

    const text = await requestAnthropic({
      maxTokens: 500,
      system:
        "You help D2C founders write a sharp one-paragraph differentiation statement. Specific, concrete, no buzzwords. Return only the statement, nothing else.",
      user: `Product: ${product}. What they can prove: ${whatCanProve}. What competitors can't copy: ${competitorsCantCopy}. Write their differentiation statement.`,
    });

    return json(res, 200, { text });
  } catch (error) {
    return json(res, 500, { error: error.message || "Edge assist failed" });
  }
};
