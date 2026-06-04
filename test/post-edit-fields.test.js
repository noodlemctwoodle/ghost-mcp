// Regression test for the "posts_edit drops meta_description" bug. Drives the real
// server over MCP against a local HTTP Ghost stand-in (no network, no credentials)
// and asserts (1) the meta/SEO fields are SENT in the PUT, and (2) they survive in
// the summarized response (summarizeWrite must not strip them).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");

const SERVER = path.resolve(__dirname, "../build/server.js");

test("posts_edit sends meta fields to Ghost and keeps them in the summarized response", async () => {
  const reqs = [];
  const ghost = http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c));
    req.on("end", () => {
      reqs.push({ method: req.method, body });
      let sent = {}; try { sent = JSON.parse(body).posts?.[0] || {}; } catch {}
      res.setHeader("Content-Type", "application/json");
      // Echo back what was sent, as Ghost would after persisting — plus a heavy body.
      res.end(JSON.stringify({ posts: [{
        id: "abc", title: sent.title ?? "T", slug: "t", status: "draft", url: "http://x/t/",
        updated_at: new Date().toISOString(),
        meta_description: sent.meta_description ?? null,
        meta_title: sent.meta_title ?? null,
        og_description: sent.og_description ?? null,
        html: "<p>" + "x".repeat(40000) + "</p>", lexical: "y".repeat(40000),
      }] }));
    });
  });
  await new Promise((r) => ghost.listen(0, r));
  const port = ghost.address().port;

  const env = { ...process.env, GHOST_API_URL: `http://127.0.0.1:${port}`, GHOST_ADMIN_API_KEY: "0123456789abcdef01234567:" + "a".repeat(64), GHOST_STAFF_TOKEN: "", GHOST_API_VERSION: "v6.0" };
  const proc = spawn("node", [SERVER], { env, stdio: ["pipe", "pipe", "pipe"] });
  let buf = ""; const pend = new Map(); let n = 1;
  proc.stdout.on("data", (d) => {
    buf += d; let nl;
    while ((nl = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, nl); buf = buf.slice(nl + 1); if (!l.trim()) continue; let m; try { m = JSON.parse(l); } catch { continue; } if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } }
  });
  const send = (method, params) => new Promise((r) => { const id = n++; pend.set(id, r); proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });

  try {
    await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } });
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    const r = await send("tools/call", { name: "posts_edit", arguments: { id: "abc", updated_at: "2026-01-01T00:00:00.000Z", meta_description: "REGRESSION DESC", meta_title: "REGRESSION TITLE", og_description: "REGRESSION OG" } });
    const out = JSON.parse((r.result?.content || []).map((x) => x.text).join(""));

    // (1) the meta fields were SENT to Ghost in the PUT
    const put = reqs.find((q) => q.method === "PUT");
    assert.ok(put, "a PUT was made");
    const sent = JSON.parse(put.body).posts[0];
    assert.equal(sent.meta_description, "REGRESSION DESC", "meta_description must be sent in the PUT");
    assert.equal(sent.meta_title, "REGRESSION TITLE");
    assert.equal(sent.og_description, "REGRESSION OG");

    // (2) they survive summarizeWrite, while the heavy body is dropped
    assert.equal(out.meta_description, "REGRESSION DESC", "meta_description must survive in the response");
    assert.equal(out.meta_title, "REGRESSION TITLE");
    assert.equal(out.og_description, "REGRESSION OG");
    assert.equal(out.html, undefined, "heavy html body is dropped");
    assert.equal(out.lexical, undefined, "heavy lexical body is dropped");
  } finally {
    proc.kill(); ghost.close();
  }
});
