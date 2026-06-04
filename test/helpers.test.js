// Unit tests for tool helpers (src/tools/helpers.ts): the compact write summary
// that keeps post/page write responses from exceeding an MCP client's size limit.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { summarizeWrite, runTool } = require("../build/tools/helpers.js");

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

test("summarizeWrite keeps meta/SEO fields and drops only heavy content (regression: meta_description)", () => {
  const post = {
    id: "p1", title: "T",
    meta_title: "MT", meta_description: "A meta description",
    og_title: "OGT", og_description: "OGD", twitter_description: "TWD",
    custom_excerpt: "EXC", canonical_url: "https://x/c",
    html: "x".repeat(50000), lexical: "y".repeat(50000),
    mobiledoc: "z".repeat(50000), plaintext: "p".repeat(50000),
  };
  const out = summarizeWrite(post);
  // meta/SEO fields survive — the bug was that these were dropped from the response
  assert.equal(out.meta_description, "A meta description");
  assert.equal(out.meta_title, "MT");
  assert.equal(out.og_description, "OGD");
  assert.equal(out.twitter_description, "TWD");
  assert.equal(out.custom_excerpt, "EXC");
  assert.equal(out.canonical_url, "https://x/c");
  // heavy body fields are dropped
  assert.equal(out.html, undefined);
  assert.equal(out.lexical, undefined);
  assert.equal(out.mobiledoc, undefined);
  assert.equal(out.plaintext, undefined);
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

test("runTool wraps a string result as-is", async () => {
  const r = await runTool(() => "Deleted.");
  assert.equal(r.content[0].text, "Deleted.");
  assert.ok(!r.isError);
});

test("runTool JSON-stringifies an object result", async () => {
  const r = await runTool(() => ({ id: "x" }));
  assert.equal(JSON.parse(r.content[0].text).id, "x");
});

test("runTool returns string text even when a tool returns undefined", async () => {
  const r = await runTool(() => undefined);
  assert.equal(typeof r.content[0].text, "string");
  assert.equal(r.content[0].text, "null");
});

test("runTool turns a thrown error into a clean isError result", async () => {
  const r = await runTool(() => { throw new Error("boom"); });
  assert.equal(r.isError, true);
  assert.equal(typeof r.content[0].text, "string");
});
