// src/tools/invites.ts
// Invites are not exposed by @tryghost/admin-api, so these go through the direct
// Admin API client. Browse and delete are staff-gated — they sign with the optional
// Staff Access Token (staff: true), and a Custom Integration key gets 403. Creating
// an invite works with the Custom Integration key, so invites_add uses the primary.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../ghostAdminClient";
import { validateEnvelope, validateWriteEnvelope, inviteSchema } from "../schemas";
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
    runTool(async () => validateWriteEnvelope(inviteSchema, await adminApiRequest("invites", { method: "POST", body: args }), "invites"))
  );

  server.tool("invites_delete", deleteParams, async (args) =>
    runTool(async () => {
      await adminApiRequest("invites", { method: "DELETE", id: args.id, staff: true });
      return `Invite with id ${args.id} deleted.`;
    })
  );
}
