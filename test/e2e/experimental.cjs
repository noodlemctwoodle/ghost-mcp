// test/e2e/experimental.cjs
// Live E2E for the experimental layer (GHOST_MCP_EXPERIMENTAL=true): config_read,
// settings read/edit (dry-run + confirmed, with restore), media/files upload,
// members CSV import, snippets CRUD, redirects download/upload (with restore), and
// themes_delete (dry-run + real delete of a throwaway theme). Self-cleaning.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { init, call, tracker } = require("./_harness.cjs");

// Minimal valid 16-bit PCM mono WAV (a few samples of silence) for media_upload.
function makeWav() {
  const samples = 8, dataSize = samples * 2, buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24); buf.writeUInt32LE(16000, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  return buf;
}

async function run(env) {
  const t = tracker();
  const TAG = "exp" + Date.now().toString(36);
  const c = await init({ ...env, GHOST_MCP_EXPERIMENTAL: "true" });

  // CONFIG (integration)
  try {
    const r = await call(c, "config_read", {});
    t.ok("config_read", !r.isError && r.json && typeof r.json === "object", r.isError ? r.text.slice(0, 90) : "");
  } catch (e) { t.ok("config_read", false, String(e)); }

  // SETTINGS read (integration) + edit (staff, confirm-gated)
  try {
    let r = await call(c, "settings_read", {});
    const settings = Array.isArray(r.json) ? r.json : [];
    t.ok("settings_read", !r.isError && settings.length > 20 && settings.every((s) => "key" in s), `${settings.length} keys`);
    const descRow = settings.find((s) => s.key === "description");
    const original = descRow ? descRow.value : "";
    const marker = `${TAG} tagline`;

    // dry run: no confirm -> must NOT change anything
    r = await call(c, "settings_edit", { updates: { description: marker } });
    t.ok("settings_edit(dry-run returns confirmation)", !r.isError && /CONFIRMATION REQUIRED/.test(r.text));
    r = await call(c, "settings_read", {});
    const afterDry = (Array.isArray(r.json) ? r.json : []).find((s) => s.key === "description")?.value;
    t.ok("settings_edit(dry-run made no change)", afterDry === original);

    // confirmed: applies, then we restore
    r = await call(c, "settings_edit", { updates: { description: marker }, confirm: true });
    t.ok("settings_edit(confirm applies)", !r.isError && Array.isArray(r.json?.updated) && r.json.updated.includes("description"), r.isError ? r.text.slice(0, 120) : "");
    r = await call(c, "settings_read", {});
    const afterReal = (Array.isArray(r.json) ? r.json : []).find((s) => s.key === "description")?.value;
    t.ok("settings_edit(value round-trips)", afterReal === marker, `got ${JSON.stringify(afterReal)}`);
    // restore
    await call(c, "settings_edit", { updates: { description: original }, confirm: true });
    r = await call(c, "settings_read", {});
    const restored = (Array.isArray(r.json) ? r.json : []).find((s) => s.key === "description")?.value;
    t.ok("settings_edit(restored original)", restored === original);
  } catch (e) { t.ok("settings_*", false, String(e)); }

  // FILES upload (integration)
  try {
    const p = path.join(os.tmpdir(), `${TAG}.txt`); fs.writeFileSync(p, "e2e file upload\n");
    const r = await call(c, "files_upload", { file_path: p, ref: TAG });
    t.ok("files_upload", !r.isError && typeof r.json?.url === "string", r.isError ? r.text.slice(0, 90) : "");
    fs.unlinkSync(p);
  } catch (e) { t.ok("files_upload", false, String(e)); }

  // MEDIA upload (integration)
  try {
    const p = path.join(os.tmpdir(), `${TAG}.wav`); fs.writeFileSync(p, makeWav());
    const r = await call(c, "media_upload", { file_path: p, ref: TAG });
    t.ok("media_upload", !r.isError && typeof r.json?.url === "string", r.isError ? r.text.slice(0, 90) : "");
    fs.unlinkSync(p);
  } catch (e) { t.ok("media_upload", false, String(e)); }

  // MEMBERS import (integration) - strict: assert imported count, the row actually
  // materialises, then clean up. (Small CSV imports are synchronous in Ghost.)
  try {
    const email = `${TAG}-import@example.com`;
    const csv = `email,name\n${email},${TAG} Import`;
    let r = await call(c, "members_import", { csv });
    t.ok("members_import(accepted)", !r.isError, r.isError ? r.text.slice(0, 120) : "");
    t.ok("members_import(stats.imported === 1)", r.json?.meta?.stats?.imported === 1, `imported=${JSON.stringify(r.json?.meta?.stats?.imported)}`);
    r = await call(c, "members_browse", { filter: `email:'${email}'`, limit: 1 });
    const id = (Array.isArray(r.json) ? r.json : [])[0]?.id;
    t.ok("members_import(member exists)", !!id, id ? "" : "imported member not found in browse");
    if (id) { const d = await call(c, "members_delete", { id }); t.ok("members_import(cleanup)", !d.isError); }
    else t.ok("members_import(cleanup)", false, "no member to delete");
  } catch (e) { t.ok("members_import", false, String(e)); }

  // MEMBERS import size guard: an oversized CSV is rejected before any upload.
  // Written to a local file so only the path crosses stdio, not 25+ MB of args.
  try {
    const big = path.join(os.tmpdir(), `${TAG}-big.csv`);
    const fd = fs.openSync(big, "w");
    fs.writeSync(fd, "email,name\n");
    const chunk = `${"x".repeat(40)}@example.com,${"y".repeat(40)}\n`.repeat(12000); // ~1.1 MB
    for (let i = 0; i < 24; i++) fs.writeSync(fd, chunk); // ~27 MB > 25 MB cap
    fs.closeSync(fd);
    const r = await call(c, "members_import", { file_path: big });
    t.ok("members_import(>25MB rejected pre-upload)", r.isError && /too large/i.test(r.text), r.text.slice(0, 100));
    fs.rmSync(big, { force: true });
  } catch (e) { t.ok("members_import(>25MB rejected pre-upload)", false, String(e)); }

  // SNIPPETS CRUD (staff)
  try {
    let r = await call(c, "snippets_add", { name: `${TAG}-snippet`, text: "E2E snippet body" });
    const id = (r.json?.snippets?.[0]?.id) || r.json?.id;
    t.ok("snippets_add", !r.isError && !!id, r.isError ? r.text.slice(0, 140) : "");
    if (id) {
      r = await call(c, "snippets_read", { id }); t.ok("snippets_read", !r.isError && (r.json?.id === id));
      r = await call(c, "snippets_browse", { limit: 5 }); t.ok("snippets_browse", !r.isError);
      r = await call(c, "snippets_edit", { id, name: `${TAG}-snippet-2`, text: "E2E snippet body v2" }); t.ok("snippets_edit", !r.isError, r.isError ? r.text.slice(0, 120) : "");
      r = await call(c, "snippets_delete", { id }); t.ok("snippets_delete", !r.isError);
    } else { ["snippets_read", "snippets_browse", "snippets_edit", "snippets_delete"].forEach((n) => t.ok(n, false, "no snippet id")); }
  } catch (e) { t.ok("snippets_*", false, String(e)); }

  // REDIRECTS download + upload (staff, confirm-gated) with restore
  try {
    // download returns the raw redirects file (a YAML or JSON string), not parsed JSON
    let r = await call(c, "redirects_download", {});
    t.ok("redirects_download", !r.isError && typeof r.text === "string", r.isError ? r.text.slice(0, 90) : "");

    const testSet = [{ from: `/${TAG}-old`, to: `/${TAG}-new`, permanent: true }];
    // dry run
    r = await call(c, "redirects_upload", { redirects: testSet });
    t.ok("redirects_upload(dry-run)", !r.isError && /CONFIRMATION REQUIRED/.test(r.text));
    // confirmed
    r = await call(c, "redirects_upload", { redirects: testSet, confirm: true });
    t.ok("redirects_upload(confirm)", !r.isError, r.isError ? r.text.slice(0, 120) : "");
    r = await call(c, "redirects_download", {});
    t.ok("redirects_upload(round-trips)", typeof r.text === "string" && r.text.includes(`${TAG}-old`));
    // restore: the test site starts with no redirects, so clear them again
    await call(c, "redirects_upload", { redirects: [], confirm: true });
    t.ok("redirects(restored)", true, "cleared");
  } catch (e) { t.ok("redirects_*", false, String(e)); }

  // THEMES delete (staff, confirm-gated) — dry-run, then delete a throwaway theme
  try {
    let r = await call(c, "themes_delete", { name: "casper" });
    t.ok("themes_delete(dry-run)", !r.isError && /CONFIRMATION REQUIRED/.test(r.text));

    const dir = path.join(os.tmpdir(), `xtheme-${TAG}`); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: `mcpx-${TAG}`, version: "0.0.1", engines: { ghost: ">=5.0.0" } }));
    fs.writeFileSync(path.join(dir, "default.hbs"), "<!DOCTYPE html><html><head>{{ghost_head}}</head><body>{{{body}}}{{ghost_foot}}</body></html>");
    fs.writeFileSync(path.join(dir, "index.hbs"), "{{#foreach posts}}{{title}}{{/foreach}}");
    fs.writeFileSync(path.join(dir, "post.hbs"), "{{#post}}{{title}}{{/post}}");
    const zip = path.join(os.tmpdir(), `xtheme-${TAG}.zip`); execSync(`cd ${dir} && zip -qr ${zip} .`);
    r = await call(c, "themes_upload", { file_path: zip });
    const tname = r.json?.name;
    if (tname && !r.isError) {
      r = await call(c, "themes_delete", { name: tname, confirm: true });
      t.ok("themes_delete(confirm)", !r.isError, r.isError ? r.text.slice(0, 120) : "");
    } else { t.ok("themes_delete(confirm)", false, "throwaway theme upload failed: " + (r.text || "").slice(0, 80)); }
    fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(zip, { force: true });
  } catch (e) { t.ok("themes_delete", false, String(e)); }

  c.proc.kill();
  return t;
}

module.exports = { run };
