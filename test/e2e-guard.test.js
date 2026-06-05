// Offline unit tests for the E2E safety guard (test/e2e/_harness.cjs
// configuredEnv): the GHOST_DEVELOPMENT developer gate (default off => refuse) and
// the GHOST_TEST_HOST cross-check. No network, no credentials.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { configuredEnv } = require("./e2e/_harness.cjs");

const KEYS = ["GHOST_API_URL", "GHOST_ADMIN_API_KEY", "GHOST_TEST_HOST", "GHOST_DEVELOPMENT", "GHOST_STAFF_TOKEN", "GHOST_API_VERSION"];
function withEnv(vars, fn) {
  const saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, vars);
  try { return fn(); } finally {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test("guard skips (returns null) when nothing is configured", () => {
  withEnv({}, () => assert.equal(configuredEnv(), null));
});

test("guard refuses when creds are set but GHOST_DEVELOPMENT is not true (production default fails closed)", () => {
  withEnv({ GHOST_API_URL: "https://t.example.com", GHOST_ADMIN_API_KEY: "k", GHOST_TEST_HOST: "t.example.com" }, () => {
    assert.throws(() => configuredEnv(), /GHOST_DEVELOPMENT/);
  });
});

test("guard still refuses on host mismatch even when GHOST_DEVELOPMENT=true", () => {
  withEnv({ GHOST_API_URL: "https://prod.example.com", GHOST_ADMIN_API_KEY: "k", GHOST_TEST_HOST: "t.example.com", GHOST_DEVELOPMENT: "true" }, () => {
    assert.throws(() => configuredEnv(), /does not contain/);
  });
});

test("guard returns env only when GHOST_DEVELOPMENT=true and the host matches", () => {
  withEnv({ GHOST_API_URL: "https://t.example.com", GHOST_ADMIN_API_KEY: "k", GHOST_TEST_HOST: "t.example.com", GHOST_DEVELOPMENT: "true" }, () => {
    const env = configuredEnv();
    assert.equal(env.GHOST_API_URL, "https://t.example.com");
    assert.equal(env.GHOST_API_VERSION, "v6.0");
  });
});

test("guard accepts 1/yes/on as truthy for GHOST_DEVELOPMENT", () => {
  for (const v of ["1", "yes", "on", "TRUE"]) {
    withEnv({ GHOST_API_URL: "https://t.example.com", GHOST_ADMIN_API_KEY: "k", GHOST_TEST_HOST: "t.example.com", GHOST_DEVELOPMENT: v }, () => {
      assert.doesNotThrow(() => configuredEnv(), `"${v}" should be truthy`);
    });
  }
});
