// Unit tests for the Admin API JWT helpers (src/ghostAdminClient.ts). Dummy env
// is set before require() because ./config exits when required vars are missing.
process.env.GHOST_API_URL = process.env.GHOST_API_URL || "https://example.com";
process.env.GHOST_ADMIN_API_KEY = process.env.GHOST_ADMIN_API_KEY ||
  "aaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
process.env.GHOST_API_VERSION = "v6.0";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { adminPrefix, generateToken } = require("../build/ghostAdminClient.js");

test("adminPrefix versions v2-v4/canary in the path, bare /admin/ for v5+", () => {
  assert.equal(adminPrefix("v2"), "/v2/admin/");
  assert.equal(adminPrefix("v3"), "/v3/admin/");
  assert.equal(adminPrefix("v4"), "/v4/admin/");
  assert.equal(adminPrefix("canary"), "/canary/admin/");
  assert.equal(adminPrefix("v4.1"), "/v4/admin/");
  assert.equal(adminPrefix("v5.0"), "/admin/");
  assert.equal(adminPrefix("v6.0"), "/admin/");
  assert.equal(adminPrefix("v5"), "/admin/");
});

test("generateToken produces a valid HS256 JWT with correct header, claims and signature", () => {
  const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const secretHex = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const token = generateToken(`${id}:${secretHex}`);

  const [h, p, s] = token.split(".");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());

  assert.equal(header.alg, "HS256");
  assert.equal(header.typ, "JWT");
  assert.equal(header.kid, id, "kid must be the key id");
  assert.equal(payload.aud, "/admin/", "v6 audience is the bare admin prefix");
  assert.equal(payload.exp - payload.iat, 300, "token expires 5 minutes after issue");

  const expectedSig = crypto
    .createHmac("sha256", Buffer.from(secretHex, "hex"))
    .update(`${h}.${p}`)
    .digest("base64url");
  assert.equal(s, expectedSig, "signature must be HMAC-SHA256 over the hex-decoded secret");
});

test("generateToken rejects a malformed key with a clear message", () => {
  assert.throws(() => generateToken("notavalidkey"), /Invalid Admin API key/);
  assert.throws(() => generateToken("aaaaaaaaaaaaaaaaaaaaaaaa:nothex!!!"), /Invalid Admin API key/);
});
