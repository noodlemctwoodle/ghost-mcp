// src/tools/experimental/themes.ts
// [experimental] Delete an installed theme (DELETE /themes/{name}/). Staff-only,
// and confirmation-gated because it is destructive. Ghost refuses to delete the
// active theme (activate another first).

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../../ghostAdminClient";
import { runTool } from "../helpers";
import { confirmationRequired } from "./confirm";

const deleteParams = {
  name: z.string().describe("Theme package/folder name to delete. Cannot be the active theme."),
  confirm: z.boolean().optional().describe("Must be true to delete. Omit for a dry run that deletes nothing."),
};

export function registerExperimentalThemeTools(server: McpServer) {
  server.tool("themes_delete", deleteParams, async (args) =>
    runTool(async () => {
      if (args.confirm !== true) {
        return confirmationRequired(`themes_delete would permanently delete the theme "${args.name}" from the site.`);
      }
      await adminApiRequest("themes", { method: "DELETE", id: args.name, staff: true });
      return `Theme ${args.name} deleted.`;
    })
  );
}
