// Validates .github/agents/*.md against the GitHub Copilot custom-agent spec
// (June 2026): `description` is required; `tools` must use the built-in aliases
// (read/search/edit/execute/web/agent/todo), `*`, or an MCP-namespaced `server/tool`;
// the prompt body must be <= 30000 characters. Runs in CI so agents can't drift.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const AGENTS_DIR = path.join(__dirname, "..", ".github", "agents");
const VALID_ALIASES = new Set(["read", "search", "edit", "execute", "web", "agent", "todo"]);

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const get = (k) => {
    const r = fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
    return r ? r[1].trim() : null;
  };
  return { description: get("description"), tools: get("tools"), body: m[2] };
}

const files = fs.existsSync(AGENTS_DIR)
  ? fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"))
  : [];

test("at least one .github/agents/*.md definition exists", () => {
  assert.ok(files.length > 0, "expected agent definitions under .github/agents/");
});

for (const f of files) {
  test(`${f} meets the GitHub Copilot custom-agent spec`, () => {
    const parsed = parseFrontmatter(fs.readFileSync(path.join(AGENTS_DIR, f), "utf8"));
    assert.ok(parsed, `${f}: missing YAML frontmatter`);
    assert.ok(parsed.description, `${f}: missing required \`description\``);
    if (parsed.tools) {
      const list = parsed.tools.replace(/[[\]"']/g, "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const t of list) {
        if (t === "*" || t.includes("/")) continue; // wildcard or MCP-namespaced tool
        assert.ok(VALID_ALIASES.has(t.toLowerCase()), `${f}: invalid tool alias "${t}" (use read/search/edit/execute/web/agent/todo)`);
      }
    }
    assert.ok(parsed.body.length <= 30000, `${f}: prompt body ${parsed.body.length} > 30000 chars`);
  });
}
