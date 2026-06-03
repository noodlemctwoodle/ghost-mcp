// src/tools/offers.ts
// Offers are not exposed by @tryghost/admin-api, so these go through the direct
// Admin API client. Ghost has no DELETE for offers — archive one with
// offers_edit (status:"archived") instead.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../ghostAdminClient";
import { runTool, browseParams, selectionParams } from "./helpers";

const readParams = {
  id: z.string(),
  ...selectionParams,
};
const addParams = {
  name: z.string(),
  code: z.string(),
  cadence: z.string().describe("'month' or 'year'."),
  type: z.string().describe("'percent' or 'fixed'."),
  amount: z.number(),
  duration: z.string().describe("'once', 'forever', or 'repeating'."),
  tier_id: z.string().describe("ID of the tier this offer applies to."),
  duration_in_months: z.number().optional(),
  currency: z.string().optional(),
  display_title: z.string().optional(),
  display_description: z.string().optional(),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  code: z.string().optional(),
  display_title: z.string().optional(),
  display_description: z.string().optional(),
  status: z.string().optional().describe("Set to 'archived' to retire the offer."),
};

// Ghost links an offer to a tier via a nested relation object, not a flat id.
function buildOfferBody(args: Record<string, any>): Record<string, unknown> {
  const { tier_id, ...rest } = args;
  return tier_id ? { ...rest, tier: { id: tier_id } } : { ...rest };
}

export function registerOfferTools(server: McpServer) {
  server.tool("offers_browse", browseParams, async (args) =>
    runTool(() => adminApiRequest("offers", { params: args }))
  );

  server.tool("offers_read", readParams, async (args) =>
    runTool(async () => {
      const { id, ...params } = args;
      const data = await adminApiRequest("offers", { id, params });
      return data.offers?.[0] ?? data;
    })
  );

  server.tool("offers_add", addParams, async (args) =>
    runTool(() => adminApiRequest("offers", { method: "POST", body: buildOfferBody(args) }))
  );

  server.tool("offers_edit", editParams, async (args) =>
    runTool(() => {
      const { id, ...body } = args;
      return adminApiRequest("offers", { method: "PUT", id, body });
    })
  );
}
