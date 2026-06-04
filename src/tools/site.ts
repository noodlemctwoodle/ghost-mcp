// src/tools/site.ts
// Read-only site information (GET /site/). Also available as the blog://info
// resource; this exposes it as a tool for parity with the other resources.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { runTool } from "./helpers";
import { validateEntity, siteSchema } from "../schemas";

export function registerSiteTools(server: McpServer) {
  server.tool("site_read", {}, async () =>
    runTool(async () => validateEntity(siteSchema, await ghostApiClient.site.read()))
  );
}
