// Unit test for config normalisation. Dummy env is set before require() because
// ./config exits when required vars are missing.
process.env.GHOST_API_URL = "https://blog.example.com/";
process.env.GHOST_ADMIN_API_KEY = "id-value-placeholder:secret-value-placeholder";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { GHOST_API_URL } = require("../build/config.js");

test("GHOST_API_URL has any trailing slash stripped", () => {
  assert.equal(GHOST_API_URL, "https://blog.example.com");
});
