// test/e2e/tools.cjs
// Live E2E across all 54 tools: create -> read -> edit -> copy -> delete/archive
// on real data, plus field-limited (no-id) browse/read and the initialize
// version check. Cleans up after itself. Returns a { pass, fail } tracker.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { init, call, tracker } = require("./_harness.cjs");

const EXPECTED_VERSION = require("../../package.json").version;
const RESTORE_THEME = process.env.GHOST_E2E_RESTORE_THEME || "source";

const first = (r) => (Array.isArray(r.json) ? r.json[0] : (r.json && r.json[Object.keys(r.json)[0]] || [])[0]);

async function run(env) {
  const t = tracker();
  const TAG = "e2e" + Date.now().toString(36);
  const c = await init(env);
  t.ok(`server reports package version (${EXPECTED_VERSION})`, c.serverVersion === EXPECTED_VERSION, `reported ${c.serverVersion}`);

  // POSTS
  try {
    let r = await call(c, "posts_add", { title: `${TAG} post`, html: "<p>hi</p>", status: "draft" });
    t.ok("posts_add", !r.isError && !!r.json?.id); const pid = r.json?.id;
    r = await call(c, "posts_read", { id: pid }); t.ok("posts_read", !r.isError && r.json?.id === pid);
    r = await call(c, "posts_read", { id: pid, fields: "title" }); t.ok("posts_read(fields,no-id)", !r.isError);
    const pr = await call(c, "posts_read", { id: pid });
    r = await call(c, "posts_edit", { id: pid, updated_at: pr.json.updated_at, title: `${TAG} edited` }); t.ok("posts_edit", !r.isError && r.json?.title?.includes("edited"));
    r = await call(c, "posts_browse", { limit: 2, fields: "id,title" }); t.ok("posts_browse", !r.isError && Array.isArray(r.json));
    r = await call(c, "posts_browse", { limit: 2, fields: "title" }); t.ok("posts_browse(fields,no-id)", !r.isError && Array.isArray(r.json));
    r = await call(c, "posts_copy", { id: pid }); t.ok("posts_copy", !r.isError && r.json?.id && r.json.id !== pid); const cp = r.json?.id;
    if (cp) { r = await call(c, "posts_delete", { id: cp }); t.ok("posts_delete(copy)", !r.isError); }
    r = await call(c, "posts_delete", { id: pid }); t.ok("posts_delete", !r.isError);
  } catch (e) { t.ok("posts_*", false, String(e)); }

  // PAGES
  try {
    let r = await call(c, "pages_add", { title: `${TAG} page`, html: "<p>p</p>", status: "draft" });
    t.ok("pages_add", !r.isError && !!r.json?.id); const id = r.json?.id;
    r = await call(c, "pages_read", { id }); t.ok("pages_read", !r.isError && r.json?.id === id);
    r = await call(c, "pages_read", { id, fields: "title" }); t.ok("pages_read(fields,no-id)", !r.isError);
    const pr = await call(c, "pages_read", { id });
    r = await call(c, "pages_edit", { id, updated_at: pr.json.updated_at, title: `${TAG} edited` }); t.ok("pages_edit", !r.isError && r.json?.title?.includes("edited"));
    r = await call(c, "pages_browse", { limit: 2, fields: "title" }); t.ok("pages_browse(fields,no-id)", !r.isError && Array.isArray(r.json));
    r = await call(c, "pages_copy", { id }); t.ok("pages_copy", !r.isError && !!r.json?.id); const cp = r.json?.id;
    if (cp) { r = await call(c, "pages_delete", { id: cp }); t.ok("pages_delete(copy)", !r.isError); }
    r = await call(c, "pages_delete", { id }); t.ok("pages_delete", !r.isError);
  } catch (e) { t.ok("pages_*", false, String(e)); }

  // TAGS
  try {
    let r = await call(c, "tags_add", { name: `${TAG}-tag` }); t.ok("tags_add", !r.isError && !!r.json?.id); const id = r.json?.id;
    r = await call(c, "tags_read", { id }); t.ok("tags_read", !r.isError && r.json?.id === id);
    r = await call(c, "tags_edit", { id, description: "e2e" }); t.ok("tags_edit", !r.isError);
    r = await call(c, "tags_browse", { limit: 2, fields: "name" }); t.ok("tags_browse(fields,no-id)", !r.isError && Array.isArray(r.json));
    r = await call(c, "tags_delete", { id }); t.ok("tags_delete", !r.isError);
  } catch (e) { t.ok("tags_*", false, String(e)); }

  // MEMBERS
  try {
    let r = await call(c, "members_add", { email: `${TAG}@example.com`, name: TAG }); t.ok("members_add", !r.isError && !!r.json?.id); const id = r.json?.id;
    r = await call(c, "members_read", { id }); t.ok("members_read", !r.isError && r.json?.id === id);
    r = await call(c, "members_edit", { id, note: "e2e" }); t.ok("members_edit", !r.isError);
    r = await call(c, "members_browse", { limit: 2, fields: "email" }); t.ok("members_browse(fields,no-id)", !r.isError && Array.isArray(r.json));
    r = await call(c, "members_delete", { id }); t.ok("members_delete", !r.isError);
  } catch (e) { t.ok("members_*", false, String(e)); }

  // NEWSLETTERS (archive, no delete)
  try {
    let r = await call(c, "newsletters_browse", { limit: 1 }); t.ok("newsletters_browse", !r.isError);
    const nf = first(r); if (nf?.id) { r = await call(c, "newsletters_read", { id: nf.id }); t.ok("newsletters_read", !r.isError && r.json?.id === nf.id); } else t.ok("newsletters_read", true, "skipped (none)");
    r = await call(c, "newsletters_add", { name: `${TAG}-nl` }); t.ok("newsletters_add", !r.isError && !!r.json?.id); const id = r.json?.id;
    if (id) { r = await call(c, "newsletters_edit", { id, status: "archived" }); t.ok("newsletters_edit(archive)", !r.isError); }
  } catch (e) { t.ok("newsletters_*", false, String(e)); }

  // TIERS (archive)
  let tierId = null;
  try {
    let r = await call(c, "tiers_browse", { limit: 5, filter: "type:paid" }); t.ok("tiers_browse", !r.isError);
    const tf = first(r); tierId = tf?.id;
    if (tf?.id) { r = await call(c, "tiers_read", { id: tf.id }); t.ok("tiers_read", !r.isError && r.json?.id === tf.id); } else t.ok("tiers_read", true, "skipped (none)");
    r = await call(c, "tiers_add", { name: `${TAG}-tier`, monthly_price: 500, yearly_price: 5000, currency: "usd" }); t.ok("tiers_add", !r.isError); const id = first(r)?.id;
    if (id) { r = await call(c, "tiers_edit", { id, active: false }); t.ok("tiers_edit(archive)", !r.isError); }
  } catch (e) { t.ok("tiers_*", false, String(e)); }

  // OFFERS (archive)
  try {
    let r = await call(c, "offers_browse", { limit: 1 }); t.ok("offers_browse", !r.isError);
    const of = first(r);
    if (of?.id) { r = await call(c, "offers_read", { id: of.id }); t.ok("offers_read", !r.isError && r.json?.id === of.id); } else t.ok("offers_read", true, "skipped (none yet)");
    if (tierId) {
      r = await call(c, "offers_add", { name: `${TAG}-offer`, code: `${TAG}code`, cadence: "month", type: "percent", amount: 10, duration: "once", tier_id: tierId }); t.ok("offers_add", !r.isError); const id = first(r)?.id;
      if (!of?.id && id) { const rr = await call(c, "offers_read", { id }); t.ok("offers_read", !rr.isError, "via created"); }
      if (id) { r = await call(c, "offers_edit", { id, status: "archived" }); t.ok("offers_edit(archive)", !r.isError); }
    } else { t.ok("offers_add", false, "no tier to attach"); t.ok("offers_edit", false, "no tier"); }
  } catch (e) { t.ok("offers_*", false, String(e)); }

  // LABELS
  try {
    let r = await call(c, "labels_add", { name: `${TAG}-label` }); t.ok("labels_add", !r.isError); const id = first(r)?.id;
    if (id) { r = await call(c, "labels_read", { id }); t.ok("labels_read", !r.isError); }
    if (id) { r = await call(c, "labels_edit", { id, slug: `${TAG}-l` }); t.ok("labels_edit", !r.isError); }
    r = await call(c, "labels_browse", { limit: 2 }); t.ok("labels_browse", !r.isError);
    if (id) { r = await call(c, "labels_delete", { id }); t.ok("labels_delete", !r.isError); }
  } catch (e) { t.ok("labels_*", false, String(e)); }

  // ROLES
  let roleId = null;
  try { let r = await call(c, "roles_browse", { limit: 50 }); t.ok("roles_browse", !r.isError); const roles = r.json?.roles || []; roleId = (roles.find((x) => x.name === "Author") || roles[0])?.id; } catch (e) { t.ok("roles_browse", false, String(e)); }

  // USERS
  try {
    let r = await call(c, "users_browse", { limit: 10, include: "roles" }); t.ok("users_browse", !r.isError);
    r = await call(c, "users_browse", { limit: 5, fields: "name" }); t.ok("users_browse(fields,no-id)", !r.isError && Array.isArray(r.json));
    const ub = await call(c, "users_browse", { limit: 10, include: "roles" });
    const list = Array.isArray(ub.json) ? ub.json : [];
    const target = list.find((u) => !(u.roles || []).some((rl) => rl.name === "Owner")) || list[0];
    if (target) { r = await call(c, "users_read", { id: target.id }); t.ok("users_read", !r.isError && r.json?.id === target.id); } else t.ok("users_read", true, "skipped (none)");
    const nonOwner = list.find((u) => !(u.roles || []).some((rl) => rl.name === "Owner"));
    if (nonOwner) { r = await call(c, "users_edit", { id: nonOwner.id, bio: nonOwner.bio ?? "e2e" }); t.ok("users_edit", !r.isError && r.json?.id === nonOwner.id, "non-owner, bio restored"); }
    else t.ok("users_edit", true, "skipped (no non-owner)");
    r = await call(c, "users_delete", { id: "000000000000000000000000" }); t.ok("users_delete", r.isError, "fake-id probe (no real delete)");
  } catch (e) { t.ok("users_*", false, String(e)); }

  // INVITES (staff token)
  try {
    let r = await call(c, "invites_browse", {}); t.ok("invites_browse", !r.isError);
    if (roleId) {
      r = await call(c, "invites_add", { role_id: roleId, email: `${TAG}-inv@example.com` }); t.ok("invites_add", !r.isError); const id = first(r)?.id;
      if (id) { r = await call(c, "invites_delete", { id }); t.ok("invites_delete", !r.isError); } else t.ok("invites_delete", false, "no invite id");
    } else { t.ok("invites_add", false, "no role id"); t.ok("invites_delete", false, "no role id"); }
  } catch (e) { t.ok("invites_*", false, String(e)); }

  // WEBHOOKS
  try {
    let r = await call(c, "webhooks_add", { event: "post.published", target_url: `https://example.com/${TAG}` }); t.ok("webhooks_add", !r.isError && !!r.json?.id); const id = r.json?.id;
    if (id) { r = await call(c, "webhooks_edit", { id, target_url: `https://example.com/${TAG}-2` }); t.ok("webhooks_edit", !r.isError); }
    if (id) { r = await call(c, "webhooks_delete", { id }); t.ok("webhooks_delete", !r.isError); }
  } catch (e) { t.ok("webhooks_*", false, String(e)); }

  // IMAGES
  try {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
    const p = path.join(os.tmpdir(), `${TAG}.png`); fs.writeFileSync(p, png);
    let r = await call(c, "images_upload", { file_path: p, ref: TAG }); t.ok("images_upload", !r.isError && typeof r.json?.url === "string", r.isError ? r.text.slice(0, 80) : "");
    fs.unlinkSync(p);
  } catch (e) { t.ok("images_upload", false, String(e)); }

  // THEMES (upload + activate, then restore)
  try {
    const dir = path.join(os.tmpdir(), `theme-${TAG}`); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: `mcp-${TAG}`, version: "0.0.1", engines: { ghost: ">=5.0.0" } }));
    fs.writeFileSync(path.join(dir, "default.hbs"), "<!DOCTYPE html><html><head>{{ghost_head}}</head><body>{{{body}}}{{ghost_foot}}</body></html>");
    fs.writeFileSync(path.join(dir, "index.hbs"), "{{#foreach posts}}{{title}}{{/foreach}}");
    fs.writeFileSync(path.join(dir, "post.hbs"), "{{#post}}{{title}}{{/post}}");
    const zip = path.join(os.tmpdir(), `theme-${TAG}.zip`); execSync(`cd ${dir} && zip -qr ${zip} .`);
    let r = await call(c, "themes_upload", { file_path: zip }); t.ok("themes_upload", !r.isError && typeof r.json?.name === "string", r.isError ? r.text.slice(0, 90) : "");
    const tname = r.json?.name;
    if (tname && !r.isError) { r = await call(c, "themes_activate", { name: tname }); t.ok("themes_activate", !r.isError && r.json?.name === tname); }
    else { r = await call(c, "themes_activate", { name: RESTORE_THEME }); t.ok("themes_activate", !r.isError, `via '${RESTORE_THEME}'`); }
    // restore a sane theme so the live site is not left on the throwaway test theme
    await call(c, "themes_activate", { name: RESTORE_THEME });
    fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(zip, { force: true });
  } catch (e) { t.ok("themes_*", false, String(e)); }

  // SITE
  try { let r = await call(c, "site_read", {}); t.ok("site_read", !r.isError && typeof r.json?.title === "string"); } catch (e) { t.ok("site_read", false, String(e)); }

  c.proc.kill();
  return t;
}

module.exports = { run };
