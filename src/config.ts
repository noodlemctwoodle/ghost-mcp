// Read configuration values directly from process.env
// Normalise away any trailing slash — @tryghost/admin-api rejects a URL that has
// one ("must not have a trailing slash"), which would otherwise crash startup.
export const GHOST_API_URL: string = (process.env.GHOST_API_URL ?? "").replace(/\/+$/, "");
export const GHOST_ADMIN_API_KEY: string = process.env.GHOST_ADMIN_API_KEY as string;
export const GHOST_API_VERSION: string = process.env.GHOST_API_VERSION as string || 'v5.0'; // Default to v5.0

// Optional Staff Access Token. When set, the staff-gated tools (users_edit,
// users_delete, invites_browse, invites_delete) authenticate with it — a Custom
// Integration key gets 403 for those. (invites_add works with the primary key.)
export const GHOST_STAFF_TOKEN: string | undefined = process.env.GHOST_STAFF_TOKEN || undefined;

// Opt-in flags (default off):
// - GHOST_MCP_EXPERIMENTAL: register the experimental, undocumented-endpoint tools.
// - GHOST_MCP_READONLY: register only read tools (browse/read/site/config + resources).
// - GHOST_MCP_DISABLED_TOOLS: comma-separated tool names to skip registering.
const truthy = (v: string | undefined): boolean => /^(1|true|yes|on)$/i.test(v ?? "");
export const GHOST_MCP_EXPERIMENTAL: boolean = truthy(process.env.GHOST_MCP_EXPERIMENTAL);
export const GHOST_MCP_READONLY: boolean = truthy(process.env.GHOST_MCP_READONLY);
export const GHOST_MCP_DISABLED_TOOLS: string[] = (process.env.GHOST_MCP_DISABLED_TOOLS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Basic validation to ensure required environment variables are set
if (!GHOST_API_URL) {
    console.error("Error: GHOST_API_URL environment variable is not set.");
    process.exit(1);
}

if (!GHOST_ADMIN_API_KEY) {
    console.error("Error: GHOST_ADMIN_API_KEY environment variable is not set.");
    process.exit(1);
}