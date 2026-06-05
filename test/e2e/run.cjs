// test/e2e/run.cjs
// Orchestrates the live end-to-end regression suites. Skips cleanly (exit 0)
// when credentials are not configured, so it is safe to wire
// into any pipeline; exits non-zero if any live assertion fails.
const { configuredEnv } = require("./_harness.cjs");

const suites = [
  ["tools", require("./tools.cjs")],
  ["settings", require("./settings.cjs")],
  ["gating", require("./gating.cjs")],
  ["leak", require("./leak.cjs")],
  ["experimental", require("./experimental.cjs")],
];

(async () => {
  let env;
  try {
    env = configuredEnv();
  } catch (e) {
    console.error(String((e && e.message) || e));
    process.exit(1);
  }
  if (!env) {
    console.log(
      "E2E skipped: set GHOST_API_URL and GHOST_ADMIN_API_KEY (plus GHOST_DEVELOPMENT=true " +
      "and optional GHOST_STAFF_TOKEN) to run the live suite."
    );
    process.exit(0);
  }

  console.log(`E2E against ${env.GHOST_API_URL}  (staff token: ${env.GHOST_STAFF_TOKEN ? "present" : "absent"})`);
  let totalPass = 0, totalFail = 0;
  for (const [name, suite] of suites) {
    console.log(`\n## ${name}`);
    let t;
    try {
      t = await suite.run(env);
    } catch (e) {
      console.error(`  SUITE ERROR: ${(e && e.stack) || e}`);
      totalFail++;
      continue;
    }
    for (const p of t.pass) console.log(`  PASS  ${p}`);
    for (const f of t.fail) console.log(`  FAIL  ${f}`);
    const s = t.summary();
    totalPass += s.passed; totalFail += s.failed;
    console.log(`  -> ${s.passed}/${s.passed + s.failed} passed`);
  }

  console.log(`\n================ E2E TOTAL ================`);
  console.log(`${totalPass} passed, ${totalFail} failed of ${totalPass + totalFail}`);
  process.exit(totalFail ? 1 : 0);
})();
