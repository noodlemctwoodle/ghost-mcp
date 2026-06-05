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
// MCP-namespaced tool: exactly one slash, e.g. `github/get_pull_request`.
const MCP_NAMESPACED = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

// Minimal, CRLF-tolerant frontmatter parser. Handles `key: value`, an inline list
// `key: [a, b]`, and a multi-line YAML list (`key:` then indented `- item` lines).
function parseFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const lines = m[1].split("\n");
  const fm = {};
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, inline] = kv;
    if (inline.trim() === "" && i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        items.push(lines[++i].replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, ""));
      }
      fm[key] = items;
    } else {
      fm[key] = inline.trim();
    }
  }
  return { fm, body: m[2] };
}

// Normalise the `tools` value (array, inline `[a,b]`, or comma string) to a list.
function toolList(tools) {
  if (tools == null) return null;
  const arr = Array.isArray(tools)
    ? tools
    : tools.replace(/^\[|\]$/g, "").split(",");
  return arr.map((s) => String(s).trim().replace(/^["']|["']$/g, "")).filter(Boolean);
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
    assert.ok(parsed.fm.description, `${f}: missing required \`description\``);

    const tools = toolList(parsed.fm.tools);
    if (tools) {
      for (const t of tools) {
        if (t === "*" || MCP_NAMESPACED.test(t)) continue;
        assert.ok(
          VALID_ALIASES.has(t.toLowerCase()),
          `${f}: invalid tool "${t}" (use an alias read/search/edit/execute/web/agent/todo, "*", or an MCP server/tool)`
        );
      }
    }
    assert.ok(parsed.body.length <= 30000, `${f}: prompt body ${parsed.body.length} > 30000 chars`);
  });
}
