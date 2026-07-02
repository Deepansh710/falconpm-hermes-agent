// Server-side PIN verification.
//
// This is a static (non-bundled) frontend, so the browser cannot read
// process.env directly the way a Next.js build would. Comparing the PIN
// server-side keeps the value out of client code entirely — the browser
// only ever sends a candidate and gets back { ok }.
//
// PIN is read from NEXT_PUBLIC_ACCESS_PIN (never hardcoded).

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const expected = process.env.NEXT_PUBLIC_ACCESS_PIN;
  if (!expected) {
    // No PIN configured — fail closed so the app can't be silently ungated.
    return json(res, 500, {
      ok: false,
      error: "Access PIN is not configured on the server",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const submitted = String(body.pin || "").trim();

    const ok = submitted.length === 6 && submitted === String(expected).trim();
    return json(res, 200, { ok });
  } catch (error) {
    return json(res, 400, { ok: false, error: "Invalid request body" });
  }
};
