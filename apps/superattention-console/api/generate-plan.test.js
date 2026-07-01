// Tests for the resilient JSON parsing in generate-plan.
// Run with:  node --test apps/superattention-console/api/
// (uses Node's built-in test runner — no dependencies required)

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  parsePlanJson,
  sanitizeJsonEscapes,
} = require("./generate-plan.js");

test("parses clean JSON unchanged (fast path)", () => {
  const raw = '{"summary": {"positioning": "Turn attention into revenue"}}';
  const parsed = parsePlanJson(raw);
  assert.equal(parsed.summary.positioning, "Turn attention into revenue");
});

test("bad escape: recovers from an escaped apostrophe in Hinglish content", () => {
  // The model emits \' which is NOT a valid JSON escape and throws
  // "Bad escaped character" in a plain JSON.parse.
  const raw = '{"hook": "aam ka achar\\\'s taste, bina tel ke"}';
  assert.throws(() => JSON.parse(raw)); // baseline: native parse fails
  const parsed = parsePlanJson(raw);
  assert.equal(parsed.hook, "aam ka achar's taste, bina tel ke");
});

test("bad escape: stray backslash becomes a literal backslash", () => {
  // "50% off\ today" — a lone backslash before a space.
  const raw = '{"cta": "50% off\\ today"}';
  assert.throws(() => JSON.parse(raw));
  const parsed = parsePlanJson(raw);
  assert.equal(parsed.cta, "50% off\\ today");
});

test("bad escape: raw newline inside a string is escaped", () => {
  const raw = '{"message": "line one\nline two"}';
  assert.throws(() => JSON.parse(raw));
  const parsed = parsePlanJson(raw);
  assert.equal(parsed.message, "line one\nline two");
});

test("valid escapes are preserved (quotes, backslash, unicode)", () => {
  const raw = '{"q": "she said \\"hi\\"", "path": "a\\\\b", "u": "\\u20b9599"}';
  const parsed = parsePlanJson(raw);
  assert.equal(parsed.q, 'she said "hi"');
  assert.equal(parsed.path, "a\\b");
  assert.equal(parsed.u, "₹599"); // ₹599
});

test("combined truncation + bad escape: recovers a partial response", () => {
  // Response is BOTH truncated mid-structure AND contains an invalid \' escape.
  // Exercises the sanitize -> truncation-repair layering in parsePlanJson.
  const raw =
    '{"summary": {"positioning": "achar\\\'s best"}, "weeklyPlan": [{"week": "Week 1", "theme": "trust';
  assert.throws(() => JSON.parse(raw));
  const parsed = parsePlanJson(raw);
  assert.equal(parsed.summary.positioning, "achar's best");
  assert.equal(parsed.weeklyPlan[0].week, "Week 1");
  assert.equal(parsed.weeklyPlan[0].theme, "trust");
});

test("sanitizeJsonEscapes leaves structural characters outside strings alone", () => {
  const raw = '{"a": "x", "b": ["y"]}';
  // No invalid escapes -> output must be byte-for-byte identical.
  assert.equal(sanitizeJsonEscapes(raw), raw);
});
