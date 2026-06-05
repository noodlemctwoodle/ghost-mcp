# Live end-to-end regression suite

These suites exercise the server against a **real Ghost instance** over the MCP
stdio protocol. They are the ground-truth regression tests: the offline unit
tests (`test/*.test.js`, run in CI) prove the logic in isolation; these prove the
tools actually work against Ghost.

They are **not** run in CI — they need real Admin API credentials, which must not
live in a public repository's secrets. Run them locally (or in a private,
manually-triggered pipeline) before cutting a release.

## Safety

The suite **refuses to run** unless `GHOST_TEST_HOST` is set and `GHOST_API_URL`
contains it. This makes it impossible to point the destructive tests at a
production blog by accident. Always use a throwaway test site — the suites
create, edit, publish, archive and delete content, upload an image and a
throwaway theme, and (briefly) activate it.

## Running

```bash
GHOST_API_URL="https://your-test-blog.example.com" \
GHOST_ADMIN_API_KEY="<id>:<secret>" \
GHOST_STAFF_TOKEN="<id>:<secret>" \
GHOST_TEST_HOST="your-test-blog.example.com" \
npm run test:e2e
```

Optional:

- `GHOST_STAFF_TOKEN` — enables the staff/invite tools (`users_edit`/`delete`, `invites_browse`/`delete`).
- `GHOST_API_VERSION` — defaults to `v6.0`.
- `GHOST_E2E_RESTORE_THEME` — theme reactivated after the theme-upload test
  (defaults to `source`).

With no env configured, `npm run test:e2e` prints a skip notice and exits 0.

## Suites (`node test/e2e/run.cjs`)

| Suite | What it proves |
|---|---|
| `tools` | All 54 tools end-to-end on real data (create→read→edit→copy→delete/archive), field-limited browse/read, image + theme upload, and the initialize version check. |
| `settings` | Every documented post-settings/metadata field round-trips via add and edit, on posts and pages (incl. `published_at` back-dating, tags, authors, `custom_template`). |
| `gating` | Integration key → admin endpoints allowed, staff endpoints 403 (no mutation); staff token flips them to allowed. |
| `leak` | Fault injection across every error branch (404/422/401/403/SSRF/ENOTFOUND/malformed-key crash) across tools and resources, scanning all stdout+stderr for any credential or JWT. |
| `experimental` | The opt-in experimental tools (config, settings, media/files upload, member CSV import, snippets, redirects, theme delete) end-to-end — including the settings/redirects/theme confirmation gate (dry-run makes no change; `confirm:true` applies) — restoring everything it touches. Sets `GHOST_MCP_EXPERIMENTAL` itself. |

> Offline registration policy (experimental opt-in, read-only mode, disabled-tools) is covered without credentials by `test/registration.test.js` in the CI unit suite.
