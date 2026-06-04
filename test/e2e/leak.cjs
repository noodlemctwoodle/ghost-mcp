// test/e2e/leak.cjs
// Exhaustive secret-leak regression: fault-inject every error branch (404, 422,
// 401 wrong key, 403 staff-gated, SSRF block, ENOTFOUND, malformed-key crash)
// across tools AND resources, then scan ALL stdout+stderr for any credential or
// JWT. Carries its own raw-capture session runner (the crash case never
// completes an MCP handshake). Returns a { pass, fail } tracker.
const { spawn } = require("node:child_process");
const { SERVER, tracker } = require("./_harness.cjs");

const half = (k) => (k && k.includes(":") ? k.split(":")[1] : null);
const JWT_RE = /eyJhbGciOiJIUzI1Ni[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
const BOGUS_KEY = "0123456789abcdef01234567:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function session(sessionEnv, requests, ms = 7000) {
  return new Promise((resolve) => {
    const proc = spawn("node", [SERVER], { env: { ...process.env, ...sessionEnv }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "", fired = false, buf = "";
    proc.stdout.on("data", (d) => {
      out += d.toString(); buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 1 && !fired) {
          fired = true;
          proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
          requests.forEach((r, i) => proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: i + 10, method: r.m, params: r.p }) + "\n"));
        }
      }
    });
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "leak", version: "1" } } }) + "\n");
    setTimeout(() => { try { proc.kill(); } catch {} resolve({ out, err }); }, ms);
  });
}

async function run(env) {
  const t = tracker();
  const REAL = [env.GHOST_ADMIN_API_KEY, half(env.GHOST_ADMIN_API_KEY), env.GHOST_STAFF_TOKEN, half(env.GHOST_STAFF_TOKEN)].filter(Boolean);
  const scan = (text, extra = []) => {
    const hits = [...REAL, ...extra].filter((s) => s && text.includes(s));
    if (JWT_RE.test(text)) hits.push("JWT");
    return hits;
  };
  const base = { ...env };

  // A: real dual-token — 404 / 422 / SSRF / resource errors + a success
  const A = await session(base, [
    { m: "tools/call", p: { name: "posts_read", arguments: { id: "000000000000000000000000" } } },
    { m: "tools/call", p: { name: "posts_add", arguments: { title: "" } } },
    { m: "tools/call", p: { name: "images_upload", arguments: { url: "http://169.254.169.254/latest/meta" } } },
    { m: "resources/read", p: { uri: "post://000000000000000000000000" } },
    { m: "resources/read", p: { uri: "user://000000000000000000000000" } },
    { m: "tools/call", p: { name: "site_read", arguments: {} } },
  ]);
  t.ok("A real dual-token error+success paths: no secret/JWT", scan(A.out + A.err).length === 0);
  t.ok("A exercised error paths", /not found|Refusing|error/i.test(A.out));

  // B: integration-only — 403 on staff endpoints
  const B = await session({ ...base, GHOST_STAFF_TOKEN: "" }, [
    { m: "tools/call", p: { name: "invites_browse", arguments: {} } },
    { m: "tools/call", p: { name: "users_edit", arguments: { id: "000000000000000000000000", bio: "x" } } },
  ]);
  t.ok("B integration-only 403 paths: no secret/JWT", scan(B.out + B.err).length === 0);
  t.ok("B exercised 403 paths", /permission|denied|authoriz/i.test(B.out + B.err));

  // C: wrong key — 401 (the in-use bogus key must not be echoed)
  const C = await session({ ...base, GHOST_ADMIN_API_KEY: BOGUS_KEY, GHOST_STAFF_TOKEN: "" }, [
    { m: "tools/call", p: { name: "posts_browse", arguments: { limit: 1 } } },
    { m: "resources/read", p: { uri: "post://000000000000000000000000" } },
  ]);
  t.ok("C wrong-key 401: in-use bogus key not echoed", scan(C.out + C.err, [BOGUS_KEY, half(BOGUS_KEY)]).length === 0);

  // D: unreachable Ghost — connection refused (deterministic and fast, unlike a
  // DNS failure whose timing varies)
  const D = await session({ ...base, GHOST_API_URL: "http://127.0.0.1:1" }, [{ m: "tools/call", p: { name: "posts_browse", arguments: { limit: 1 } } }], 10000);
  t.ok("D unreachable Ghost: no secret/JWT", scan(D.out + D.err).length === 0);
  t.ok("D exercised network-error path", /Ghost API error|Cannot reach|ECONNREFUSED|ENOTFOUND|reach Ghost/i.test(D.out + D.err));

  // E: malformed key — crash at startup, must be redacted by the fatal handler
  const E = await session({ ...base, GHOST_ADMIN_API_KEY: "notavalidkeyformat", GHOST_STAFF_TOKEN: "" }, [
    { m: "tools/call", p: { name: "posts_browse", arguments: { limit: 1 } } },
  ]);
  t.ok("E malformed-key crash: key not leaked", scan(E.out + E.err, ["notavalidkeyformat"]).length === 0);

  return t;
}

module.exports = { run };
