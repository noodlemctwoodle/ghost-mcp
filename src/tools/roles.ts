// src/tools/roles.ts
// Roles are not exposed by @tryghost/admin-api, so these go through the direct
// Admin API client. Read-only (roles are not created/edited via this server).

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../ghostAdminClient";
import { runTool, browseParams, selectionParams } from "./helpers";

const readParams = {
  id: z.string(),
  ...selectionParams,
};

export function registerRoleTools(server: McpServer) {
  server.tool("roles_browse", browseParams, async (args) =>
    runTool(() => adminApiRequest("roles", { params: args }))
  );

  server.tool("roles_read", readParams, async (args) =>
    runTool(async () => {
      const { id, ...params } = args;
      const data = await adminApiRequest("roles", { id, params });
      return data.roles?.[0] ?? data;
    })
  );
}
