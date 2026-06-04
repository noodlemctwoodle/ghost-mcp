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

A **Custom Integration** Admin API key from your Ghost site (Ghost Admin → **Settings → Advanced → Integrations → Add custom integration**). Use the **Admin API Key** (format `{id}:{secret}` — note the colon), not the Content API key.

| Variable | Required | Notes |
|---|---|---|
| `GHOST_API_URL` | yes | Base URL, e.g. `https://yourblog.com` (no trailing slash, no `/ghost`) |
| `GHOST_ADMIN_API_KEY` | yes | Admin API key in `{id}:{secret}` form |
| `GHOST_API_VERSION` | no | Defaults to `v5.0`; `v6.0` also supported |

## Authentication & token types

`GHOST_ADMIN_API_KEY` accepts two kinds of `{id}:{secret}` key. Both use the same JWT auth, but Ghost grants different permissions:

- **Custom Integration key** (Settings → Advanced → Integrations) — a scoped, fixed permission set. Manages content, members, tags, tiers, offers, newsletters, etc. It **cannot manage staff**: `users_edit`, `users_delete`, `invites_browse` and `invites_delete` return **403** with this key. Safer, and recommended for most setups.
- **Staff Access Token** (from a staff user's profile page) — authenticates *as that user* with their **role's** permissions. An **Administrator/Owner** token enables the staff/invite tools above. It's high-privilege — keep it secret, and for an LLM-driven server weigh the access it grants before using one in production.

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
