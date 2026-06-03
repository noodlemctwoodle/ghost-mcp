// src/tools/tiers.ts
// Tiers are not exposed by @tryghost/admin-api, so these go through the direct
// Admin API client. Ghost has no DELETE for tiers — archive a tier with
// tiers_edit (active:false) instead.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../ghostAdminClient";
import { runTool, browseParams, selectionParams } from "./helpers";

const readParams = {
  id: z.string(),
  ...selectionParams,
};
const sharedFields = {
  description: z.string().optional(),
  welcome_page_url: z.string().optional(),
  visibility: z.string().optional(),
  monthly_price: z.number().optional(),
  yearly_price: z.number().optional(),
  currency: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  active: z.boolean().optional(),
};
const addParams = {
  name: z.string(),
  ...sharedFields,
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  ...sharedFields,
};

export function registerTierTools(server: McpServer) {
  server.tool("tiers_browse", browseParams, async (args) =>
    runTool(() => adminApiRequest("tiers", { params: args }))
  );

  server.tool("tiers_read", readParams, async (args) =>
    runTool(async () => {
      const { id, ...params } = args;
      const data = await adminApiRequest("tiers", { id, params });
      return data.tiers?.[0] ?? data;
    })
  );

  server.tool("tiers_add", addParams, async (args) =>
    runTool(() => adminApiRequest("tiers", { method: "POST", body: args }))
  );

  server.tool("tiers_edit", editParams, async (args) =>
    runTool(() => {
      const { id, ...body } = args;
      return adminApiRequest("tiers", { method: "PUT", id, body });
    })
  );
}
