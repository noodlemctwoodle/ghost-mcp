// Unit tests for credential redaction (src/redaction.ts). Pure functions plus a
// subprocess that proves installSecretRedaction scrubs real stdout/stderr writes.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { buildSecretList, redactSecrets } = require("../build/redaction.js");

const ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SECRET = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const KEY = `${ID}:${SECRET}`;

test("buildSecretList includes the full key + secret half, drops the id half and short values", () => {
  const list = buildSecretList([KEY, undefined, "short", ""]);
  assert.ok(list.includes(KEY), "full key present");
  assert.ok(list.includes(SECRET), "secret half present");
  assert.ok(!list.includes(ID), "id half (public kid) excluded");
  assert.ok(!list.includes("short"), "short value excluded");
});

test("redactSecrets scrubs configured secret and secret half", () => {
  const out = redactSecrets(`token=${KEY} secret=${SECRET}`, buildSecretList([KEY]));
  assert.ok(!out.includes(KEY));
  assert.ok(!out.includes(SECRET));
  assert.ok(out.includes("[REDACTED]"));
});

test("redactSecrets scrubs a Ghost JWT auth header without any configured secret", () => {
  const jwt = "eyJhbGciOiJIUzI1NiIsImtpZCI6IngifQ.eyJhIjoxfQ.s1gnatureValue";
  const out = redactSecrets(`Authorization: Ghost ${jwt}`, []);
  assert.ok(!out.includes("eyJhbGci"));
  assert.ok(out.includes("[REDACTED]"));
});

test("redactSecrets scrubs a bare HS256 JWT", () => {
  const out = redactSecrets("tok eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig rest", []);
  assert.ok(!out.includes("eyJhbGci"));
});

test("redactSecrets leaves ordinary text untouched", () => {
  assert.equal(redactSecrets("a normal post about cats", []), "a normal post about cats");
});

test("installSecretRedaction scrubs real stdout/stderr writes (subprocess)", () => {
  const mod = JSON.stringify(path.resolve(__dirname, "../build/redaction.js"));
  const code = `const R=require(${mod});R.installSecretRedaction(["SENTINELSECRET1234567890"]);` +
    `process.stdout.write("OUT SENTINELSECRET1234567890 end\\n");` +
    `process.stderr.write("ERR SENTINELSECRET1234567890 end\\n");`;
  const r = spawnSync(process.execPath, ["-e", code], { encoding: "utf8" });
  const all = `${r.stdout}${r.stderr}`;
  assert.ok(!all.includes("SENTINELSECRET1234567890"), "sentinel leaked through a process stream");
  assert.ok(all.includes("[REDACTED]"), "redaction marker not present");
});
