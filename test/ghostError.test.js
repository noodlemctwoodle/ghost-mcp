// Unit tests for error normalisation (src/ghostError.ts), including the redaction
// layer in formatGhostError.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toGhostError, formatGhostError, GhostError } = require("../build/ghostError.js");

test("toGhostError maps a Ghost API error envelope to message + status + context", () => {
  const e = toGhostError({
    response: { status: 422, data: { errors: [{ message: "Validation failed", type: "ValidationError", context: "title" }] } },
  });
  assert.equal(e.statusCode, 422);
  assert.equal(e.message, "Validation failed");
  assert.equal(e.context, "title");
});

test("toGhostError maps 401/403 to an auth-failure message", () => {
  assert.match(toGhostError({ response: { status: 401 } }).message, /Authentication failed/);
  assert.match(toGhostError({ statusCode: 403 }).message, /Authentication failed/);
});

test("toGhostError maps 404 to a not-found message", () => {
  assert.match(toGhostError({ response: { status: 404 } }).message, /Not found/);
});

test("toGhostError maps network errors to a reachability message", () => {
  for (const code of ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT"]) {
    assert.match(toGhostError({ code }).message, /Cannot reach Ghost/);
  }
});

test("toGhostError passes an existing GhostError through unchanged", () => {
  const g = new GhostError("custom");
  assert.equal(toGhostError(g), g);
});

test("toGhostError falls back to the raw message", () => {
  assert.equal(toGhostError({ message: "boom" }).message, "boom");
});

test("formatGhostError redacts a JWT that appears in an error message", () => {
  const out = formatGhostError({ message: "fail Ghost eyJhbGciOiJIUzI1NiIsImtpZCI6IngifQ.eyJhIjoxfQ.sig" });
  assert.ok(!out.includes("eyJhbGci"), "JWT leaked through formatGhostError");
  assert.ok(out.includes("[REDACTED]"));
});

test("formatGhostError includes status and context lines", () => {
  const out = formatGhostError({ response: { status: 422, data: { errors: [{ message: "bad", context: "ctx" }] } } });
  assert.match(out, /Ghost API error: bad/);
  assert.match(out, /Context: ctx/);
  assert.match(out, /HTTP status: 422/);
});
