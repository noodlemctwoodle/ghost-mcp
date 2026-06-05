// src/tools/experimental/config.ts
// [experimental] Read the site's Admin API config (GET /config/). Authenticates
// with the Custom Integration key. Read-only.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../../ghostAdminClient";
import { validateSelectable, configSchema } from "../../schemas";
import { runTool } from "../helpers";

export function registerConfigTools(server: McpServer) {
  server.tool("config_read", {}, async () =>
    runTool(async () => {
      const data = await adminApiRequest("config");
      return validateSelectable(configSchema, data.config ?? data);
    })
  );
}
