// Offline unit tests for the experimental layer: read-only/disabled-tools policy
// classification, the confirmation gate, the multipart upload helper, and the
// adminApiRequest bodyArray path (settings PUT). Mocks the axios adapter — no
// network — and asserts request construction and dual-token routing.
process.env.GHOST_API_URL = "https://blog.example.com";
process.env.GHOST_ADMIN_API_KEY = "a".repeat(24) + ":" + "b".repeat(64);
process.env.GHOST_STAFF_TOKEN = "c".repeat(24) + ":" + "d".repeat(64);
process.env.GHOST_API_VERSION = "v6.0";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { adminApiRequest, adminApiUpload } = require("../build/ghostAdminClient.js");
const { isReadOnlyToolName } = require("../build/tools/policy.js");
const { confirmationRequired } = require("../build/tools/experimental/confirm.js");

const ADMIN_ID = "a".repeat(24);
const STAFF_ID = "c".repeat(24);

let last = null;
axios.defaults.adapter = async (config) => {
  last = config;
  return { data: { settings: [{ key: "title", value: "X" }], meta: {}, ok: true }, status: 200, statusText: "OK", headers: {}, config };
};

const kidOf = (cfg) => {
  const auth = cfg.headers.Authorization || cfg.headers.authorization;
  const header = String(auth).replace("Ghost ", "").split(".")[0];
  return JSON.parse(Buffer.from(header, "base64url").toString()).kid;
};

test("isReadOnlyToolName: browse/read/download are reads; everything else is a write", () => {
  for (const n of ["posts_browse", "settings_read", "config_read", "snippets_read", "redirects_download", "site_read"]) {
    assert.ok(isReadOnlyToolName(n), `${n} should be read-only`);
  }
  for (const n of ["settings_edit", "media_upload", "files_upload", "members_import", "snippets_add", "snippets_delete", "redirects_upload", "themes_delete", "posts_add"]) {
    assert.ok(!isReadOnlyToolName(n), `${n} should be a write`);
  }
});

test("confirmationRequired: states no change made, includes the summary and the confirm instruction", () => {
  const msg = confirmationRequired("would change 2 settings");
  assert.match(msg, /CONFIRMATION REQUIRED/);
  assert.match(msg, /no change has been made yet/);
  assert.match(msg, /would change 2 settings/);
  assert.match(msg, /"confirm": true/);
});

test("adminApiRequest bodyArray: PUT /settings/ sends { settings: [..] } verbatim (not double-wrapped), signed with staff token", async () => {
  last = null;
  await adminApiRequest("settings", { method: "PUT", bodyArray: [{ key: "title", value: "X" }, { key: "description", value: "Y" }], staff: true });
  assert.equal(last.method.toUpperCase(), "PUT");
  assert.match(last.url, /\/ghost\/api\/admin\/settings\/$/);
  assert.deepEqual(JSON.parse(last.data), { settings: [{ key: "title", value: "X" }, { key: "description", value: "Y" }] });
  assert.equal(kidOf(last), STAFF_ID);
});

test("adminApiUpload: members import posts multipart to /members/upload/ with the integration key", async () => {
  last = null;
  const res = await adminApiUpload("members/upload", { field: "membersfile", filename: "members.csv", contentType: "text/csv", data: "email\nx@y.com", staff: false });
  assert.equal(last.method.toUpperCase(), "POST");
  assert.match(last.url, /\/ghost\/api\/admin\/members\/upload\/$/);
  assert.equal(kidOf(last), ADMIN_ID, "members import uses the integration key");
  assert.ok(last.data instanceof FormData, "body is multipart FormData");
  const part = last.data.get("membersfile");
  assert.ok(part, "the membersfile field is present");
  assert.equal(part.name, "members.csv", "the part carries the filename");
  assert.equal(res.ok, true, "returns the parsed response body");
});

test("adminApiUpload: redirects upload posts to /redirects/upload/ signed with the staff token", async () => {
  last = null;
  await adminApiUpload("redirects/upload", { field: "redirects", filename: "redirects.json", contentType: "application/json", data: "[]", staff: true });
  assert.match(last.url, /\/ghost\/api\/admin\/redirects\/upload\/$/);
  assert.equal(kidOf(last), STAFF_ID, "redirects upload uses the staff token");
  assert.equal(last.data.get("redirects").name, "redirects.json");
});

test("adminApiUpload: a content-length cap is set to bound the request body", async () => {
  last = null;
  await adminApiUpload("members/upload", { field: "membersfile", filename: "m.csv", contentType: "text/csv", data: "email", staff: false });
  assert.ok(last.maxBodyLength > 0 && last.maxContentLength > 0, "body/content length caps are set");
});
