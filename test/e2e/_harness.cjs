// test/e2e/_harness.cjs
// Shared helpers for the LIVE end-to-end regression suite.
//
// Credentials are read from the environment (never committed). A hard guard
// refuses to run unless GHOST_TEST_HOST is set and GHOST_API_URL contains it —
// so the suite can never be pointed at a production site by accident.
//
//   GHOST_API_URL=https://your-test.example.com \
//   GHOST_ADMIN_API_KEY=<id:secret> \
//   GHOST_STAFF_TOKEN=<id:secret>            # optional, enables staff/invite tools \
//   GHOST_TEST_HOST=your-test.example.com \
//   npm run test:e2e
const { spawn } = require("node:child_process");
const path = require("node:path");

const SERVER = path.resolve(__dirname, "../../build/server.js");

// Returns the live env, or null when not configured (callers should skip).
// Throws if configured but the URL does not match the declared test host.
function configuredEnv() {
  const url = process.env.GHOST_API_URL || "";
  const key = process.env.GHOST_ADMIN_API_KEY || "";
  const testHost = process.env.GHOST_TEST_HOST || "";
  if (!url || !key || !testHost) return null;
  if (!url.includes(testHost)) {
    throw new Error(
      `E2E guard: GHOST_API_URL (${url}) does not contain GHOST_TEST_HOST (${testHost}). Refusing to run.`
    );
  }
  return {
    GHOST_API_URL: url,
    GHOST_ADMIN_API_KEY: key,
    GHOST_API_VERSION: process.env.GHOST_API_VERSION || "v6.0",
    GHOST_STAFF_TOKEN: process.env.GHOST_STAFF_TOKEN || "",
  };
}

function startClient(env) {
  const proc = spawn("node", [SERVER], { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
  let buf = "", stderr = "";
  const pending = new Map();
  let nextId = 1;
  proc.stderr.on("data", (d) => (stderr += d.toString()));
  proc.stdout.on("data", (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    }
  });
  const send = (method, params) => new Promise((resolve) => {
    const id = nextId++; pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  const notify = (method, params) => proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  return { proc, send, notify, getStderr: () => stderr };
}

async function init(env) {
  const c = startClient(env);
  const res = await c.send("initialize", {
    protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "e2e", version: "1" },
  });
  c.notify("notifications/initialized", {});
  c.serverVersion = res?.result?.serverInfo?.version;
  return c;
}

async function call(c, name, args) {
  const m = await c.send("tools/call", { name, arguments: args || {} });
  if (m.error) return { isError: true, text: JSON.stringify(m.error), json: null };
  const text = (m.result?.content || []).map((x) => x.text).join("\n");
  let json = null; try { json = JSON.parse(text); } catch {}
  return { isError: !!m.result?.isError, text, json };
}

function tracker() {
  const pass = [], fail = [];
  return {
    pass, fail,
    ok(name, cond, note = "") { (cond ? pass : fail).push(`${name}${note ? " — " + note : ""}`); },
    summary() { return { passed: pass.length, failed: fail.length }; },
  };
}

module.exports = { SERVER, configuredEnv, startClient, init, call, tracker };
