// src/tools/webhooks.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { runTool } from "./helpers";

const addParams = {
  event: z.string(),
  target_url: z.string(),
  name: z.string().optional(),
  secret: z.string().optional(),
  api_version: z.string().optional(),
  integration_id: z.string().optional(),
};
const editParams = {
  id: z.string(),
  event: z.string().optional(),
  target_url: z.string().optional(),
  name: z.string().optional(),
  api_version: z.string().optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerWebhookTools(server: McpServer) {
  server.tool("webhooks_add", addParams, async (args) =>
    runTool(() => ghostApiClient.webhooks.add(args))
  );

  server.tool("webhooks_edit", editParams, async (args) =>
    runTool(() => ghostApiClient.webhooks.edit(args))
  );

  server.tool("webhooks_delete", deleteParams, async (args) =>
    runTool(async () => {
      await ghostApiClient.webhooks.delete(args);
      return `Webhook with id ${args.id} deleted.`;
    })
  );
}
