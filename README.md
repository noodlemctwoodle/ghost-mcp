# Ghost MCP Server

A Model Context Protocol (MCP) server for interacting with Ghost CMS through LLM interfaces like Claude. It provides comprehensive, authenticated access to the Ghost Admin API for managing posts, pages, members, tags, tiers, offers, newsletters, labels, users, roles, invites, webhooks, images and themes.

![demo](./assets/ghost-mcp-demo.gif)

## Features

- Authenticated Ghost Admin API access using short-lived JWTs (via `@tryghost/admin-api`)
- Complete coverage of the **documented** Admin API surface — including resources the official client does not expose (tiers, offers, roles, invites, labels) via a small direct API client
- Response trimming: `fields`, `formats` and `include` parameters on browse/read tools to keep payloads small
- Consistent error handling: failures are returned as a clean `GhostError` message instead of crashing the tool call
- Responses validated against lenient zod schemas (preserves Ghost's full field set; catches malformed responses)
- Hardened remote-URL uploads: an SSRF guard rejects private/internal/metadata hosts, with no redirects and size/timeout limits
- Optional **[experimental tools](#experimental-tools-opt-in)** (`GHOST_MCP_EXPERIMENTAL`) for verified-but-undocumented endpoints — site config & settings, media/files uploads, member CSV import, snippets, redirects and theme deletion — with destructive config writes confirmation-gated
- **Read-only mode** (`GHOST_MCP_READONLY`) and per-tool disabling (`GHOST_MCP_DISABLED_TOOLS`) to scope what the server can do
- Ghost v5 and v6 supported

## Requirements

Keys are `{id}:{secret}` (note the colon — *not* the Content API key). `GHOST_ADMIN_API_KEY` is the primary key; `GHOST_STAFF_TOKEN` is optional and, when set, is used for the staff/invite tools.

| Variable | Required | Notes |
|---|---|---|
| `GHOST_API_URL` | yes | Base URL, e.g. `https://yourblog.com` (no trailing slash, no `/ghost`) |
| `GHOST_ADMIN_API_KEY` | yes | Primary key — a Custom Integration **Admin API key** *or* a **Staff Access Token** |
| `GHOST_STAFF_TOKEN` | no | Optional **Staff Access Token**. When set, `users_edit`, `users_delete` and the `invites_*` tools authenticate with it — so you can keep an Integration key as the primary and still manage staff/invites |
| `GHOST_API_VERSION` | no | Defaults to `v5.0`; `v6.0` also supported |
| `GHOST_MCP_EXPERIMENTAL` | no | `true` to also register the [experimental tools](#experimental-tools-opt-in) (undocumented endpoints). Off by default |
| `GHOST_MCP_READONLY` | no | `true` to register **only** read tools (`*_browse`, `*_read`, `*_download`); every write/upload/delete is withheld |
| `GHOST_MCP_DISABLED_TOOLS` | no | Comma-separated tool names to skip registering, e.g. `posts_delete,members_delete` |

**For 100% tool coverage**, set `GHOST_ADMIN_API_KEY` to a **Custom Integration key** (covers webhooks, content, themes) *and* `GHOST_STAFF_TOKEN` to an **Administrator Staff Access Token** (covers users/invites). See [Authentication & token types](#authentication--token-types) for why neither key alone is enough, and how to create each.

## Authentication & token types

Ghost gates some endpoints by token type, and **no single key covers every tool**. The server can hold both keys and routes each call to the right one — the staff/invite tools use `GHOST_STAFF_TOKEN` when it's set, otherwise they fall back to `GHOST_ADMIN_API_KEY` (returning a clean 403 if that key lacks the permission).

**Admin endpoints** — work with a **Custom Integration** key (`GHOST_ADMIN_API_KEY`). This is the large majority: posts, pages, tags, members, newsletters, tiers, offers, labels, roles, images, **themes**, **webhooks**, site, and `invites_add`. *(Webhooks are integration-only — a staff token cannot create them, so keep an Integration key as the primary.)*

**Staff endpoints** — require a **Staff Access Token** (`GHOST_STAFF_TOKEN`); a Custom Integration key returns **403**. Just four tools:

- `users_edit`, `users_delete` — edit / remove a staff user
- `invites_browse`, `invites_delete` — list / revoke pending staff invites

The server routes these four to `GHOST_STAFF_TOKEN` when it's set; otherwise they fall back to `GHOST_ADMIN_API_KEY` and return a clean 403 if that key can't perform them.

Both keys are `{id}:{secret}` and use the same JWT auth.

### Custom Integration key

Scoped, fixed permissions — manages content, members, tags, tiers, offers, newsletters, **webhooks** and themes. It **cannot manage staff** (`users_edit/delete`, `invites_browse/delete` → 403). Recommended as the **primary** (`GHOST_ADMIN_API_KEY`).

**Create it:** Ghost Admin → **Settings → Advanced → Integrations → Add custom integration** → name it → copy the **Admin API Key** (`{id}:{secret}`, with a colon — *not* the Content API Key).

### Staff Access Token

Authenticates *as a staff user* with that user's **role** permissions; an **Administrator** token enables the staff/invite tools. High-privilege — treat it like a password, and for an LLM-driven server weigh the access it grants before using one in production. Put it in `GHOST_STAFF_TOKEN`.

**Create / capture it:**
1. Sign in as an **Administrator** (avoid the Owner — its token is rejected by some endpoints, e.g. themes).
2. Open that user's profile — account avatar (bottom-left) → **Your profile**, or **Settings → Staff → [the user]**.
3. Scroll to the bottom of the profile page to **Staff access token**.
4. Copy it immediately — Ghost shows it only once (regenerate for a fresh one).

## Usage

### Run from source (this repository)

```bash
npm install
npm run build
```

Then point your MCP client (e.g. Claude Desktop, `claude_desktop_config.json`) at the built server:

```json
{
  "mcpServers": {
    "ghost-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/ghost-mcp/build/server.js"],
      "env": {
        "GHOST_API_URL": "https://yourblog.com",
        "GHOST_ADMIN_API_KEY": "your_integration_admin_api_key",
        "GHOST_STAFF_TOKEN": "your_admin_staff_access_token",
        "GHOST_API_VERSION": "v6.0"
      }
    }
  }
}
```

> Use the absolute path to `node` (e.g. `/opt/homebrew/bin/node`) if your MCP client doesn't inherit your shell `PATH`.

### Run the published package

```json
{
  "mcpServers": {
    "ghost-mcp": {
      "command": "npx",
      "args": ["-y", "@fanyangmeng/ghost-mcp"],
      "env": {
        "GHOST_API_URL": "https://yourblog.com",
        "GHOST_ADMIN_API_KEY": "your_integration_admin_api_key",
        "GHOST_STAFF_TOKEN": "your_admin_staff_access_token",
        "GHOST_API_VERSION": "v6.0"
      }
    }
  }
}
```

## Available Tools

Tools cover the Ghost Admin API operations exposed by `@tryghost/admin-api`, plus the documented endpoints the official client omits (tiers, offers, roles, invites, labels, copy).

### Admin endpoints

Work with the **Custom Integration** key (`GHOST_ADMIN_API_KEY`):

| Resource | Tools |
|---|---|
| **Posts** | `posts_browse`, `posts_read`, `posts_add`, `posts_edit`, `posts_delete`, `posts_copy` |
| **Pages** | `pages_browse`, `pages_read`, `pages_add`, `pages_edit`, `pages_delete`, `pages_copy` |
| **Tags** | `tags_browse`, `tags_read`, `tags_add`, `tags_edit`, `tags_delete` |
| **Members** | `members_browse`, `members_read`, `members_add`, `members_edit`, `members_delete` |
| **Newsletters** | `newsletters_browse`, `newsletters_read`, `newsletters_add`, `newsletters_edit` |
| **Tiers** | `tiers_browse`, `tiers_read`, `tiers_add`, `tiers_edit` |
| **Offers** | `offers_browse`, `offers_read`, `offers_add`, `offers_edit` |
| **Labels** | `labels_browse`, `labels_read`, `labels_add`, `labels_edit`, `labels_delete` |
| **Users** | `users_browse`, `users_read` |
| **Roles** | `roles_browse` |
| **Invites** | `invites_add` |
| **Webhooks** | `webhooks_add`, `webhooks_edit`, `webhooks_delete` |
| **Images** | `images_upload` |
| **Themes** | `themes_upload`, `themes_activate` |
| **Site** | `site_read` |

### Staff endpoints

Require a **Staff Access Token** (`GHOST_STAFF_TOKEN`) — a Custom Integration key returns **403**:

| Resource | Tools |
|---|---|
| **Users** | `users_edit`, `users_delete` |
| **Invites** | `invites_browse`, `invites_delete` |

Notes:
- **Archiving instead of deleting**: tiers, offers and newsletters have no delete tool — Ghost archives them. Use the `_edit` tool: `active: false` (tiers), `status: "archived"` (offers and newsletters). Roles are browse-only (no read-by-id).
- **Uploads**: `images_upload` and `themes_upload` accept either a local `file_path` or a `url`. Remote URLs are fetched server-side behind an SSRF guard (only public http(s) hosts — private, loopback, link-local and cloud-metadata addresses are refused), with no redirects, a 15s timeout and a 25 MB cap. A local `file_path` reads a file on the machine running the server (Ghost validates the content server-side).
- **Copy**: `posts_copy` / `pages_copy` create a draft duplicate.

### Experimental tools (opt-in)

Set `GHOST_MCP_EXPERIMENTAL=true` to additionally register tools for Admin API endpoints that **work but aren't part of the official `@tryghost/admin-api` client**. They're verified against Ghost v6 by a live E2E suite, but are **unsupported** and may change across Ghost releases — hence opt-in and off by default.

Token routing follows the same boundary as the core tools — reads and uploads use the Integration key; settings/snippets/redirects/theme-delete need a Staff Access Token:

| Resource | Tools | Token |
|---|---|---|
| **Config** | `config_read` | Integration |
| **Settings** | `settings_read` | Integration |
| **Settings** | `settings_edit` *(confirm-gated)* | Staff |
| **Media** | `media_upload` | Integration |
| **Files** | `files_upload` | Integration |
| **Members** | `members_import` (CSV) | Integration |
| **Snippets** | `snippets_browse`, `snippets_read`, `snippets_add`, `snippets_edit`, `snippets_delete` | Staff |
| **Redirects** | `redirects_download` | Staff |
| **Redirects** | `redirects_upload` *(confirm-gated)* | Staff |
| **Themes** | `themes_delete` *(confirm-gated)* | Staff |

- **Confirmation gate.** `settings_edit`, `redirects_upload` and `themes_delete` overwrite or remove live site configuration. Called **without** `confirm: true` they make **no change** — they return an exact summary of what *would* happen (for settings, a `key: old → new` diff) and ask the caller to re-invoke with `confirm: true`. A deliberate second checkpoint for an LLM-driven client.
- **Snippets** are stored as Mobiledoc on current Ghost: pass plain `text` (converted automatically) or a raw `mobiledoc` JSON string — Lexical-only is rejected by the API.
- **Redirects.** `redirects_download` returns the raw redirects file (YAML or JSON, as stored). `redirects_upload` takes a JSON array of `{ from, to, permanent }` and **replaces the entire set** — include every redirect you want to keep.
- **Theme delete** cannot remove the **active** theme — activate another first.

### Operating modes

- **Read-only** — `GHOST_MCP_READONLY=true` registers only `*_browse`, `*_read` and `*_download` tools; every create/edit/delete/upload (core *and* experimental) is withheld at registration, so a write tool is never exposed to the model.
- **Disable specific tools** — `GHOST_MCP_DISABLED_TOOLS="posts_delete,themes_delete"` skips exactly those tools, whatever else is enabled.

### Keeping responses small

Browse/read tools accept `fields` (e.g. `id,title,status,url`) and `include`; posts/pages also accept `formats` (`html`, `plaintext`, `mobiledoc`, `lexical`). By default Ghost returns large content payloads, so pass `fields` when listing to avoid oversized responses.

## Available Resources

Single entities can also be read as MCP resources:

`user://{id}`, `member://{id}`, `tier://{id}`, `offer://{id}`, `newsletter://{id}`, `post://{id}`, `page://{id}`, and `blog://info` (site details).

## Prompts

The server also exposes one MCP prompt:

- **`summarize-post`** — given a `postId`, fetches the post and returns a ready-to-send "summarise this post" message.

## Architecture

- **`@tryghost/admin-api`** handles auth, posts/pages/tags/members/users/newsletters/webhooks and image/theme uploads.
- A small **direct Admin API client** (`src/ghostAdminClient.ts`) covers the documented endpoints the official package omits — tiers, offers, roles, invites, labels, and the post/page `copy` action — using the same JWT scheme.
- **Every tool and resource validates its response** against a lenient zod schema (`src/schemas.ts`); the upload **SSRF guard** lives in `src/security.ts`.
- **Opt-in experimental tools** (`src/tools/experimental/`) reach further verified-but-undocumented endpoints (config, settings, media/files, member CSV import, snippets, redirects, theme delete) via the direct client plus a multipart upload helper (`adminApiUpload`); the registration policy for read-only mode and disabled-tools lives in `src/tools/policy.ts`.

## Error Handling

API and network failures are normalised by `GhostError` (`src/ghostError.ts`) into a clear message and returned as an MCP error result, so a failed call surfaces a readable reason rather than crashing. Every tool validates its response against a lenient zod schema (`src/schemas.ts`), so a genuinely malformed response is reported rather than passed through silently.

## Security

This server holds Admin API credentials and acts on your live Ghost site, so it is built to fail safe:

- **Least-privilege tokens (gating).** Use the scoped **Custom Integration** key as the primary (`GHOST_ADMIN_API_KEY`) — it cannot touch staff. Only add a **Staff Access Token** (`GHOST_STAFF_TOKEN`) if you need the four [staff endpoints](#staff-endpoints): it authenticates *as that staff user with all of their permissions* (an Administrator token is effectively full-admin), so treat it like a password and weigh the access carefully before handing it to an LLM-driven client. Each call is routed to the correct token, and a key that lacks a permission gets a clean **403** — the server never silently escalates.
- **SSRF guard on uploads.** When you pass a remote `url` to `images_upload` or `themes_upload`, the URL is validated *before* any fetch (`src/security.ts`): only `http`/`https` schemes are allowed; `localhost`, `*.localhost` and `*.internal` hosts are refused; and the hostname is DNS-resolved with **every** resolved address checked against private, loopback, link-local, CGNAT, cloud-metadata (`169.254.169.254`), IPv6 unique-local and multicast/reserved ranges (IPv4, IPv6 and IPv4-mapped IPv6). The download then allows **no redirects**, times out after **15s**, and is capped at **25 MB**. This stops the model from steering the server into internal infrastructure. *(This is SSRF — server-side request forgery — not CSRF: the server runs over stdio with no browser, cookies or session.)*
- **Input & response validation.** The MCP SDK enforces each tool's typed parameter schema on the way in. On the way out, **every tool validates its response** against a lenient zod schema (`src/schemas.ts`): browse/read are field-tolerant (a `fields` selector may legitimately omit keys, including `id`), while writes and uploads require a fully-formed entity. A malformed payload is reported, not passed through.
- **Secret redaction (defence in depth).** Credentials are read only from environment variables. A redaction layer (`src/redaction.ts`), installed before any other module loads, scrubs the configured key/secret — and any Ghost JWT auth value — from **every byte written to stdout/stderr**, and an `uncaughtException`/`unhandledRejection` handler redacts fatal errors too (Node's crash printer bypasses the stream wrapper). So no path — ours, the MCP SDK's, or a dependency's axios error carrying the `Authorization` header — can leak a credential. Verified by fault-injecting every error branch (404 / 422 / 401 / 403 / SSRF / network / malformed-key) across tools **and** resources and scanning all output.
- **Local files.** A local `file_path` upload reads from the filesystem of the machine running the server, so run it only where you trust the inputs.
- **Opt-in experimental surface & confirmation gate.** The [experimental tools](#experimental-tools-opt-in) (undocumented endpoints) are **off unless `GHOST_MCP_EXPERIMENTAL=true`**. The three that overwrite live configuration — `settings_edit`, `redirects_upload`, `themes_delete` — are **confirmation-gated**: without `confirm: true` they change nothing and return a diff/summary first. **Read-only mode** (`GHOST_MCP_READONLY=true`) withholds every write tool, and `GHOST_MCP_DISABLED_TOOLS` removes named tools — both enforced at registration, so a withheld tool is never exposed to the model.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

## License

MIT
