// src/tools/roles.ts
// Roles are not exposed by @tryghost/admin-api, so this goes through the direct
// Admin API client. Browse-only: Ghost has no read-by-id endpoint for roles.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../ghostAdminClient";
import { validateEnvelope, roleSchema } from "../schemas";
import { runTool, browseParams } from "./helpers";

export function registerRoleTools(server: McpServer) {
  server.tool("roles_browse", browseParams, async (args) =>
    runTool(async () => validateEnvelope(roleSchema, await adminApiRequest("roles", { params: args }), "roles"))
  );
}
