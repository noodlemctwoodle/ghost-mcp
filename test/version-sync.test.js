// Guards against package.json / package-lock.json version drift (the lockfile sat
// at 0.3.0 while package.json moved to 0.4.x). Asserts the project version is
// identical across package.json and both places package-lock.json records it.
// Runs in the CI unit suite, so a bump that forgets the lockfile fails the build.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const pkg = require("../package.json");
const lock = require("../package-lock.json");

test("package-lock.json version is in sync with package.json", () => {
  assert.equal(lock.version, pkg.version, `package-lock root version (${lock.version}) must match package.json (${pkg.version})`);
  assert.equal(
    lock.packages[""].version,
    pkg.version,
    `package-lock packages[""] version (${lock.packages[""].version}) must match package.json (${pkg.version})`
  );
});
