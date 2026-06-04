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
- Ghost v5 and v6 supported

## Requirements

A Ghost Admin API key in `{id}:{secret}` form (note the colon — *not* the Content API key). `GHOST_ADMIN_API_KEY` accepts **either**:

- a **Custom Integration key** — scoped; recommended for most setups, or
- a **Staff Access Token** — authenticates as a staff user with their role's permissions; **required** for the staff/invite/user-management tools (`users_edit`, `users_delete`, `invites_browse`, `invites_delete`).

See [**Authentication & token types**](#authentication--token-types) below for the trade-offs and **how to create each**.

| Variable | Required | Notes |
|---|---|---|
| `GHOST_API_URL` | yes | Base URL, e.g. `https://yourblog.com` (no trailing slash, no `/ghost`) |
| `GHOST_ADMIN_API_KEY` | yes | A Custom Integration **Admin API key** *or* a **Staff Access Token** — both `{id}:{secret}` |
| `GHOST_API_VERSION` | no | Defaults to `v5.0`; `v6.0` also supported |

## Authentication & token types

`GHOST_ADMIN_API_KEY` accepts two kinds of `{id}:{secret}` key. Both use the same JWT auth (so either drops straight into the same env var with no code change), but Ghost grants different permissions.

### Custom Integration key (recommended)

A scoped, fixed permission set — manages content, members, tags, tiers, offers, newsletters, etc. It **cannot manage staff**: `users_edit`, `users_delete`, `invites_browse` and `invites_delete` return **403** with this key. Safer for most setups.

**Create it:** Ghost Admin → **Settings → Advanced → Integrations → Add custom integration** → give it a name → copy the **Admin API Key** (the `{id}:{secret}` value with a colon — *not* the Content API Key).

### Staff Access Token (for staff/invite/user management)

Authenticates *as a staff user* with that user's **role** permissions. Use an **Administrator** or **Owner** token to enable the staff/invite tools above. It is high-privilege — treat it like a password; for an LLM-driven server, weigh the access it grants before using one in production.

**Create / capture it:**
1. Sign in as the user whose permissions you need (an **Administrator** or the **Owner** for staff/invite management).
2. Open that user's profile — click the account avatar (bottom-left) → **Your profile**, or **Settings → Staff → [the user]**.
3. Scroll to the bottom of the profile page to **Staff access token**.
4. Copy it (use the regenerate control if you need a fresh one). Copy it immediately — Ghost shows it only once.

It's the same `{id}:{secret}` shape as an integration key, so put it straight into `GHOST_ADMIN_API_KEY`.

`roles_browse`, `users_browse`/`users_read` and `invites_add` work with either key.

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
        "GHOST_ADMIN_API_KEY": "your_admin_api_key",
        "GHOST_API_VERSION": "v5.0"
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
        "GHOST_ADMIN_API_KEY": "your_admin_api_key",
        "GHOST_API_VERSION": "v5.0"
      }
    }
  }
}
```

## Available Tools

Tools cover the Ghost Admin API operations exposed by `@tryghost/admin-api`, plus the documented endpoints the official client omits (tiers, offers, roles, invites, labels, copy).

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
| **Users** | `users_browse`, `users_read`, `users_edit`, `users_delete` |
| **Roles** | `roles_browse` |
| **Invites** | `invites_browse`, `invites_add`, `invites_delete` |
| **Webhooks** | `webhooks_add`, `webhooks_edit`, `webhooks_delete` |
| **Images** | `images_upload` |
| **Themes** | `themes_upload`, `themes_activate` |
| **Site** | `site_read` |

Notes:
- **Archiving instead of deleting**: tiers, offers and newsletters have no delete tool — Ghost archives them. Use the `_edit` tool: `active: false` (tiers), `status: "archived"` (offers and newsletters). Roles are browse-only (no read-by-id).
- **Uploads**: `images_upload` and `themes_upload` accept either a local `file_path` or a `url`. Remote URLs are fetched server-side behind an SSRF guard (only public http(s) hosts — private, loopback, link-local and cloud-metadata addresses are refused), with no redirects, a 15s timeout and a 25 MB cap. A local `file_path` reads a file on the machine running the server (Ghost validates the content server-side).
- **Copy**: `posts_copy` / `pages_copy` create a draft duplicate.

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
- Response **validation** lives in `src/schemas.ts`; the upload **SSRF guard** lives in `src/security.ts`.

## Error Handling

API and network failures are normalised by `GhostError` (`src/ghostError.ts`) into a clear message and returned as an MCP error result, so a failed call surfaces a readable reason rather than crashing. Responses are validated against lenient zod schemas (`src/schemas.ts`), so a genuinely malformed response is reported rather than passed through silently.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

## License

MIT
