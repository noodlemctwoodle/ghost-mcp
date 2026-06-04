// Unit tests for response validation (src/schemas.ts): strict for writes,
// field-tolerant for browse/read, envelope handling, and the no-id schemas.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../build/schemas.js");

test("validateEntity accepts a valid entity and passes unknown fields through", () => {
  const v = S.validateEntity(S.postSchema, { id: "abc", title: "x", weird_extra: 1 });
  assert.equal(v.id, "abc");
  assert.equal(v.weird_extra, 1);
});

test("validateEntity rejects an entity missing its id", () => {
  assert.throws(() => S.validateEntity(S.postSchema, { title: "x" }));
});

test("validateSelectable tolerates a missing id (field-limited browse/read)", () => {
  assert.doesNotThrow(() => S.validateSelectable(S.postSchema, { title: "x" }));
});

test("validateSelectable still rejects a wrong field type and non-objects", () => {
  assert.throws(() => S.validateSelectable(S.postSchema, { title: 123 }));
  assert.throws(() => S.validateSelectable(S.postSchema, "an error string"));
  assert.throws(() => S.validateSelectable(S.postSchema, null));
});

test("validateSelectableList accepts an array (mixed id presence), rejects non-arrays", () => {
  assert.doesNotThrow(() => S.validateSelectableList(S.postSchema, [{ id: "a" }, { title: "b" }]));
  assert.throws(() => S.validateSelectableList(S.postSchema, { id: "a" }));
});

test("validateEnvelope validates the inner array, returns the envelope, rejects bad inner items", () => {
  const env = { tiers: [{ id: "t1" }], meta: { page: 1 } };
  assert.equal(S.validateEnvelope(S.tierSchema, env, "tiers"), env);
  assert.throws(() => S.validateEnvelope(S.tierSchema, { tiers: [123] }, "tiers"));
});

test("imageSchema requires url; themeSchema requires name", () => {
  assert.throws(() => S.validateEntity(S.imageSchema, { ref: "x" }));
  assert.doesNotThrow(() => S.validateEntity(S.imageSchema, { url: "https://x/y.png" }));
  assert.throws(() => S.validateEntity(S.themeSchema, { active: true }));
  assert.doesNotThrow(() => S.validateEntity(S.themeSchema, { name: "casper", active: true }));
});
