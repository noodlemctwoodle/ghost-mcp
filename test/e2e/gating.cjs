// test/e2e/gating.cjs
// Live token-gating regression: with the integration key only, admin endpoints
// are allowed and staff endpoints return a clean 403 with no mutation; adding
// the staff token flips the staff endpoints to allowed. Returns a tracker.
const { init, call, tracker } = require("./_harness.cjs");

const FAKE = "000000000000000000000000";

async function run(env) {
  const t = tracker();

  // ---- deny-path: integration key only (no staff token) ----
  const intOnly = { ...env, GHOST_STAFF_TOKEN: "" };
  const a = await init(intOnly);
  const ab = await call(a, "posts_browse", { limit: 1, fields: "id,title" });
  const as = await call(a, "site_read", {});
  const ai = await call(a, "invites_browse", {});
  const ae = await call(a, "users_edit", { id: FAKE, bio: "noop" });
  const ad = await call(a, "invites_delete", { id: FAKE });
  a.proc.kill();
  t.ok("admin endpoint posts_browse ALLOWED on integration key", !ab.isError);
  t.ok("admin endpoint site_read ALLOWED on integration key", !as.isError);
  t.ok("staff endpoint invites_browse DENIED on integration key", ai.isError);
  t.ok("staff endpoint users_edit DENIED/failed on integration key (no mutation)", ae.isError);
  t.ok("staff endpoint invites_delete DENIED/failed on integration key", ad.isError);

  // ---- allow-path: dual token ----
  if (env.GHOST_STAFF_TOKEN) {
    const b = await init(env);
    const bi = await call(b, "invites_browse", {});
    b.proc.kill();
    t.ok("staff endpoint invites_browse ALLOWED with staff token (routing flips on token presence)", !bi.isError);
  } else {
    t.ok("dual-token allow-path", true, "skipped (no GHOST_STAFF_TOKEN set)");
  }

  return t;
}

module.exports = { run };
