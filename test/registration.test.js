// Offline registration policy tests: spawn the built server with a dummy key
// (well-formed but non-functional) and list tools under each policy mode. No
// network and no real credentials — tools/list only exercises registration. Runs
// in CI to lock in the experimental opt-in, read-only mode, and disabled-tools.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { startClient } = require("./e2e/_harness.cjs");

const BASE = {
  GHOST_API_URL: "http://127.0.0.1:1",
  GHOST_ADMIN_API_KEY: "aaaaaaaaaaaaaaaaaaaaaaaa:" + "b".repeat(64),
  GHOST_API_VERSION: "v6.0",
  GHOST_STAFF_TOKEN: "cccccccccccccccccccccccc:" + "d".repeat(64),
};

const EXPERIMENTAL = [
  "config_read", "settings_read", "settings_edit", "media_upload", "files_upload",
  "members_import", "snippets_browse", "snippets_read", "snippets_add", "snippets_edit",
  "snippets_delete", "redirects_download", "redirects_upload", "themes_delete",
];

async function listTools(env) {
  const c = startClient({ ...BASE, ...env });
  await c.send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "reg", version: "1" } });
  c.notify("notifications/initialized", {});
  const res = await c.send("tools/list", {});
  c.proc.kill();
  return (res.result?.tools || []).map((x) => x.name);
}

test("experimental tools are off by default and on only when GHOST_MCP_EXPERIMENTAL is set", async () => {
  const base = await listTools({});
  const exp = await listTools({ GHOST_MCP_EXPERIMENTAL: "true" });
  for (const t of EXPERIMENTAL) {
    assert.ok(!base.includes(t), `default mode must NOT register ${t}`);
    assert.ok(exp.includes(t), `experimental mode must register ${t}`);
  }
  assert.equal(exp.length, base.length + EXPERIMENTAL.length, "experimental adds exactly the experimental tools");
});

test("GHOST_MCP_READONLY keeps browse/read/download and drops every write (core + experimental)", async () => {
  const ro = await listTools({ GHOST_MCP_EXPERIMENTAL: "true", GHOST_MCP_READONLY: "true" });
  const kept = ["config_read", "settings_read", "snippets_browse", "snippets_read", "redirects_download", "posts_browse", "posts_read", "site_read"];
  const dropped = ["settings_edit", "media_upload", "files_upload", "members_import", "snippets_add", "snippets_edit", "snippets_delete", "redirects_upload", "themes_delete", "posts_add", "posts_edit", "posts_delete", "themes_upload", "images_upload"];
  for (const t of kept) assert.ok(ro.includes(t), `read-only must keep ${t}`);
  for (const t of dropped) assert.ok(!ro.includes(t), `read-only must drop ${t}`);
  assert.ok(ro.every((t) => /(_browse|_read|_download)$/.test(t)), "every read-only tool is a browse/read/download");
});

test("GHOST_MCP_DISABLED_TOOLS removes exactly the named tools", async () => {
  const base = await listTools({});
  const disabled = await listTools({ GHOST_MCP_DISABLED_TOOLS: "posts_delete, members_delete" });
  assert.ok(!disabled.includes("posts_delete"), "removes posts_delete");
  assert.ok(!disabled.includes("members_delete"), "removes members_delete");
  assert.equal(disabled.length, base.length - 2, "removes exactly two tools");
});
