// src/tools/invites.ts
// Invites are not exposed by @tryghost/admin-api, so these go through the direct
// Admin API client. They are staff-management operations, so they sign with the
// optional Staff Access Token (staff: true) — a Custom Integration key gets 403.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../ghostAdminClient";
import { validateEnvelope, inviteSchema } from "../schemas";
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
    runTool(async () => validateEnvelope(inviteSchema, await adminApiRequest("invites", { params: args, staff: true }), "invites"))
  );

  server.tool("invites_add", addParams, async (args) =>
    runTool(async () => validateEnvelope(inviteSchema, await adminApiRequest("invites", { method: "POST", body: args, staff: true }), "invites"))
  );

  server.tool("invites_delete", deleteParams, async (args) =>
    runTool(async () => {
      await adminApiRequest("invites", { method: "DELETE", id: args.id, staff: true });
      return `Invite with id ${args.id} deleted.`;
    })
  );
}
