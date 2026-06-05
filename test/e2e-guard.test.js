// Offline unit tests for the E2E safety guard (test/e2e/_harness.cjs
// configuredEnv): the GHOST_DEVELOPMENT developer gate (default off => refuse).
// No network, no credentials.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { configuredEnv } = require("./e2e/_harness.cjs");

const KEYS = ["GHOST_API_URL", "GHOST_ADMIN_API_KEY", "GHOST_DEVELOPMENT", "GHOST_STAFF_TOKEN", "GHOST_API_VERSION"];
function withEnv(vars, fn) {
  const saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, vars);
  try { return fn(); } finally {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test("guard skips (returns null) when no credentials are configured", () => {
  withEnv({}, () => assert.equal(configuredEnv(), null));
  // the flag alone, with no credentials, still skips
  withEnv({ GHOST_DEVELOPMENT: "true" }, () => assert.equal(configuredEnv(), null));
});

test("guard refuses when creds are set but GHOST_DEVELOPMENT is not true (production default fails closed)", () => {
  withEnv({ GHOST_API_URL: "https://anything.example.com", GHOST_ADMIN_API_KEY: "k" }, () => {
    assert.throws(() => configuredEnv(), /GHOST_DEVELOPMENT/);
  });
});

test("guard returns env when creds are set and GHOST_DEVELOPMENT=true", () => {
  withEnv({ GHOST_API_URL: "https://dev.example.com", GHOST_ADMIN_API_KEY: "k", GHOST_DEVELOPMENT: "true" }, () => {
    const env = configuredEnv();
    assert.equal(env.GHOST_API_URL, "https://dev.example.com");
    assert.equal(env.GHOST_API_VERSION, "v6.0");
  });
});

test("guard accepts 1/yes/on/TRUE as truthy for GHOST_DEVELOPMENT", () => {
  for (const v of ["1", "yes", "on", "TRUE"]) {
    withEnv({ GHOST_API_URL: "https://dev.example.com", GHOST_ADMIN_API_KEY: "k", GHOST_DEVELOPMENT: v }, () => {
      assert.doesNotThrow(() => configuredEnv(), `"${v}" should be truthy`);
    });
  }
});
