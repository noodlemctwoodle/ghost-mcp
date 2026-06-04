// Unit tests for resolveUploadFile / cleanupTempFile (src/fileUpload.ts). Mocks
// the axios adapter and uses a public IP literal, so no network or DNS is needed.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const axios = require("axios");
const { resolveUploadFile, cleanupTempFile } = require("../build/fileUpload.js");

axios.defaults.adapter = async (config) => ({ data: Buffer.from("FAKEDATA"), status: 200, statusText: "OK", headers: {}, config });

test("url download lands in a private temp dir; cleanup removes it", async () => {
  const f = await resolveUploadFile(undefined, "http://93.184.216.34/pic.png");
  assert.ok(f.path.includes("ghost-mcp-"), "uses a ghost-mcp- temp dir");
  assert.ok(fs.existsSync(f.path), "file is written");
  assert.equal(fs.readFileSync(f.path).toString(), "FAKEDATA");
  const dir = f.cleanupDir;
  assert.ok(dir, "a cleanup dir is returned for downloads");
  cleanupTempFile(f);
  assert.ok(!fs.existsSync(dir), "temp dir is removed on cleanup");
});

test("url with a trailing-slash path falls back to a safe filename inside the temp dir", async () => {
  const f = await resolveUploadFile(undefined, "http://93.184.216.34/");
  assert.ok(f.path.includes("ghost-mcp-"), "stays inside the private temp dir");
  assert.match(f.path, /upload\.bin$/, "falls back to a safe name");
  assert.ok(fs.existsSync(f.path));
  cleanupTempFile(f);
});

test("url download is refused for an SSRF-unsafe URL before fetching", async () => {
  await assert.rejects(() => resolveUploadFile(undefined, "http://169.254.169.254/latest/meta"));
});

test("local path is returned as-is with no cleanup dir, and cleanup is a no-op", async () => {
  const f = await resolveUploadFile(__filename, undefined);
  assert.equal(f.path, __filename);
  assert.equal(f.cleanupDir, undefined);
  cleanupTempFile(f);
  assert.ok(fs.existsSync(__filename), "local file must never be deleted");
});

test("neither argument throws", async () => {
  await assert.rejects(() => resolveUploadFile());
});
