// Unit tests for tool helpers (src/tools/helpers.ts): the compact write summary
// that keeps post/page write responses from exceeding an MCP client's size limit.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { summarizeWrite } = require("../build/tools/helpers.js");

test("summarizeWrite keeps identity/status fields and drops heavy body fields", () => {
  const post = {
    id: "abc123",
    title: "Hello",
    slug: "hello",
    status: "published",
    url: "https://blog.example.com/hello/",
    updated_at: "2026-06-04T15:00:00.000Z",
    lexical: "x".repeat(50000),
    html: "<p>" + "y".repeat(50000) + "</p>",
    mobiledoc: "z".repeat(50000),
  };
  const out = summarizeWrite(post);
  assert.deepEqual(out, {
    id: "abc123",
    title: "Hello",
    slug: "hello",
    status: "published",
    url: "https://blog.example.com/hello/",
    updated_at: "2026-06-04T15:00:00.000Z",
  });
  assert.equal(out.lexical, undefined);
  assert.equal(out.html, undefined);
  assert.equal(out.mobiledoc, undefined);
  // The whole point: the summary is small.
  assert.ok(JSON.stringify(out).length < 500);
});

test("summarizeWrite only includes fields that are present", () => {
  const out = summarizeWrite({ id: "p1", status: "draft" });
  assert.deepEqual(out, { id: "p1", status: "draft" });
});

test("summarizeWrite returns non-objects unchanged", () => {
  assert.equal(summarizeWrite("Post deleted."), "Post deleted.");
  assert.equal(summarizeWrite(null), null);
  assert.equal(summarizeWrite(undefined), undefined);
  assert.equal(summarizeWrite(42), 42);
});

test("summarizeWrite returns the original object when it has none of the summary fields", () => {
  const odd = { name: "casper", active: true };
  assert.equal(summarizeWrite(odd), odd);
});
