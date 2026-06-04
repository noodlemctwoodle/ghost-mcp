// test/e2e/settings.cjs
// Coverage proof for the full post-settings/metadata field set (issue #15): set
// every documented field via posts_add/edit and pages_add/edit, read back, and
// assert each round-trips. Cleans up. Returns a { pass, fail } tracker.
const { init, call, tracker } = require("./_harness.cjs");

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const dateEq = (a, b) => b != null && Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 2000;
const hasTag = (name, tags) => Array.isArray(tags) && tags.some((x) => x.name === name);
const hasAuthor = (id, authors) => Array.isArray(authors) && authors.some((a) => a.id === id);

async function run(env) {
  const t = tracker();
  const TAG = "cov" + Date.now().toString(36);
  const c = await init(env);
  const check = (label, expected, actual, cmp) => t.ok(label, cmp ? cmp(expected, actual) : eq(expected, actual), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

  const ub = await call(c, "users_browse", { limit: 1 });
  const ownerId = (Array.isArray(ub.json) ? ub.json[0] : null)?.id;

  const meta = {
    slug: `${TAG}-slug`, visibility: "members", custom_excerpt: `${TAG} excerpt`,
    feature_image: "https://images.example.com/feat.jpg", feature_image_alt: `${TAG} alt`, feature_image_caption: `${TAG} caption`,
    meta_title: `${TAG} meta title`, meta_description: `${TAG} meta desc`,
    og_title: `${TAG} og title`, og_description: `${TAG} og desc`, og_image: "https://images.example.com/og.jpg",
    twitter_title: `${TAG} tw title`, twitter_description: `${TAG} tw desc`, twitter_image: "https://images.example.com/tw.jpg",
    canonical_url: "https://example.com/canonical-x",
    codeinjection_head: `<meta name="${TAG}-head">`, codeinjection_foot: `<!-- ${TAG}-foot -->`,
    custom_template: "custom-test",
  };
  const tags = [{ name: `${TAG}-tag` }];
  const authors = ownerId ? [{ id: ownerId }] : undefined;

  // POSTS: add everything, read back, assert each
  let r = await call(c, "posts_add", { title: `${TAG} post`, html: "<p>body</p>", status: "draft", featured: true, ...meta, tags, ...(authors ? { authors } : {}) });
  t.ok("posts_add (no error)", !r.isError, r.text.slice(0, 90));
  const pid = r.json?.id;
  if (pid) {
    const p = (await call(c, "posts_read", { id: pid, include: "tags,authors" })).json || {};
    for (const [k, v] of Object.entries(meta)) check(`post.${k}`, v, p[k]);
    check("post.featured", true, p.featured);
    check("post.tags[name]", `${TAG}-tag`, p.tags, (e, a) => hasTag(e, a));
    if (authors) check("post.authors[id]", ownerId, p.authors, (e, a) => hasAuthor(e, a));

    // POSTS: edit (publish + back-dated published_at + change several)
    const pubAt = "2025-06-01T09:30:00.000Z";
    const e = await call(c, "posts_edit", { id: pid, updated_at: p.updated_at, status: "published", published_at: pubAt, meta_title: `${TAG} meta EDITED`, og_title: `${TAG} og EDITED`, featured: false });
    t.ok("posts_edit (no error)", !e.isError, e.text.slice(0, 90));
    const p2 = (await call(c, "posts_read", { id: pid })).json || {};
    check("post.status=published (edit)", "published", p2.status);
    check("post.published_at (edit)", pubAt, p2.published_at, dateEq);
    check("post.meta_title (edit)", `${TAG} meta EDITED`, p2.meta_title);
    check("post.og_title (edit)", `${TAG} og EDITED`, p2.og_title);
    check("post.featured=false (edit)", false, p2.featured);
    await call(c, "posts_delete", { id: pid });
  }

  // PAGES: add the page field set, read back
  const pageMeta = { ...meta, slug: `${TAG}-pgslug` };
  let pr = await call(c, "pages_add", { title: `${TAG} page`, html: "<p>body</p>", status: "draft", show_title_and_feature_image: false, ...pageMeta, tags, ...(authors ? { authors } : {}) });
  t.ok("pages_add (no error)", !pr.isError, pr.text.slice(0, 90));
  const gid = pr.json?.id;
  if (gid) {
    const g = (await call(c, "pages_read", { id: gid, include: "tags,authors" })).json || {};
    for (const [k, v] of Object.entries(pageMeta)) check(`page.${k}`, v, g[k]);
    check("page.show_title_and_feature_image", false, g.show_title_and_feature_image);
    check("page.tags[name]", `${TAG}-tag`, g.tags, (e, a) => hasTag(e, a));
    const ge = await call(c, "pages_edit", { id: gid, updated_at: g.updated_at, meta_description: `${TAG} pg EDITED`, custom_template: "custom-test-2" });
    t.ok("pages_edit (no error)", !ge.isError, ge.text.slice(0, 90));
    const g2 = (await call(c, "pages_read", { id: gid })).json || {};
    check("page.meta_description (edit)", `${TAG} pg EDITED`, g2.meta_description);
    check("page.custom_template (edit)", "custom-test-2", g2.custom_template);
    await call(c, "pages_delete", { id: gid });
  }

  c.proc.kill();
  return t;
}

module.exports = { run };
