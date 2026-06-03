// src/tools/invites.ts
// Invites are not exposed by @tryghost/admin-api, so these go through the direct
// Admin API client. Invites support browse, add and delete.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../ghostAdminClient";
import { runTool, browseParams } from "./helpers";

const addParams = {
  role_id: z.string().describe("ID of the role to invite the user as (see roles_browse)."),
  email: z.string(),
};
const deleteParams = {
  id: z.string(),
};

export function registerInviteTools(server: McpServer) {
  server.tool("invites_browse", browseParams, async (args) =>
    runTool(() => adminApiRequest("invites", { params: args }))
  );

  server.tool("invites_add", addParams, async (args) =>
    runTool(() => adminApiRequest("invites", { method: "POST", body: args }))
  );

  server.tool("invites_delete", deleteParams, async (args) =>
    runTool(async () => {
      await adminApiRequest("invites", { method: "DELETE", id: args.id });
      return `Invite with id ${args.id} deleted.`;
    })
  );
}
