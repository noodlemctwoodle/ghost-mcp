// Offline tool-layer regression for the direct Admin API client. Mocks the axios
// adapter (no network) and asserts request construction — method, URL, body
// envelope — and the dual-token routing (which credential signs each call).
process.env.GHOST_API_URL = "https://blog.example.com";
process.env.GHOST_ADMIN_API_KEY = "a".repeat(24) + ":" + "b".repeat(64);
process.env.GHOST_STAFF_TOKEN = "c".repeat(24) + ":" + "d".repeat(64);
process.env.GHOST_API_VERSION = "v6.0";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { adminApiRequest } = require("../build/ghostAdminClient.js");
const { ghostApiClient, ghostStaffClient } = require("../build/ghostApi.js");

const ADMIN_ID = "a".repeat(24);
const STAFF_ID = "c".repeat(24);

// Intercept every axios() call the direct client makes; record the request config
// and return a canned Ghost envelope.
let last = null;
axios.defaults.adapter = async (config) => {
  last = config;
  return { data: { tiers: [{ id: "t1" }], invites: [{ id: "i1" }], meta: {} }, status: 200, statusText: "OK", headers: {}, config };
};

// Decode the `kid` (key id) from the JWT in the Authorization header.
const kidOf = (cfg) => {
  const auth = cfg.headers.Authorization || cfg.headers.authorization;
  const header = String(auth).replace("Ghost ", "").split(".")[0];
  return JSON.parse(Buffer.from(header, "base64url").toString()).kid;
};

test("browse: GET /ghost/api/admin/<resource>/ signed with the integration key", async () => {
  last = null;
  await adminApiRequest("tiers", { params: { limit: 5 } });
  assert.equal((last.method || "GET").toUpperCase(), "GET");
  assert.match(last.url, /\/ghost\/api\/admin\/tiers\/$/);
  assert.equal(last.params.limit, 5);
  assert.equal(kidOf(last), ADMIN_ID);
});

test("add: POST wraps the body as { <resource>: [body] }", async () => {
  last = null;
  await adminApiRequest("tiers", { method: "POST", body: { name: "Gold" } });
  assert.equal(last.method.toUpperCase(), "POST");
  assert.deepEqual(JSON.parse(last.data), { tiers: [{ name: "Gold" }] });
  assert.equal(kidOf(last), ADMIN_ID);
});

test("read-by-id: id segment is in the URL", async () => {
  last = null;
  await adminApiRequest("tiers", { id: "abc123" });
  assert.match(last.url, /\/admin\/tiers\/abc123\/$/);
});

test("action: appends the action segment (e.g. copy)", async () => {
  last = null;
  await adminApiRequest("posts", { method: "POST", id: "p1", action: "copy" });
  assert.match(last.url, /\/admin\/posts\/p1\/copy\/$/);
});

test("delete: uses the DELETE method", async () => {
  last = null;
  await adminApiRequest("labels", { method: "DELETE", id: "l1" });
  assert.equal(last.method.toUpperCase(), "DELETE");
});

test("dual-token routing: staff:true signs with the staff token, otherwise the integration key", async () => {
  last = null;
  await adminApiRequest("invites", { staff: true });
  assert.equal(kidOf(last), STAFF_ID, "staff endpoints must be signed with the staff token");
  last = null;
  await adminApiRequest("tiers", {});
  assert.equal(kidOf(last), ADMIN_ID, "non-staff calls use the integration key");
});

test("ghostStaffClient is a distinct client when GHOST_STAFF_TOKEN is set", () => {
  assert.notEqual(ghostStaffClient, ghostApiClient);
});
