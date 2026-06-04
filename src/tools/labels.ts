// src/tools/labels.ts
// Member labels are not exposed by @tryghost/admin-api, so these go through the
// direct Admin API client. Full CRUD per the Admin API docs (/labels/).

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../ghostAdminClient";
import { validateSelectable, validateEnvelope, validateWriteEnvelope, labelSchema } from "../schemas";
import { runTool, browseParams, selectionParams } from "./helpers";

const readParams = {
  id: z.string(),
  ...selectionParams,
};
const addParams = {
  name: z.string(),
  slug: z.string().optional(),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  slug: z.string().optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerLabelTools(server: McpServer) {
  server.tool("labels_browse", browseParams, async (args) =>
    runTool(async () => validateEnvelope(labelSchema, await adminApiRequest("labels", { params: args }), "labels"))
  );

  server.tool("labels_read", readParams, async (args) =>
    runTool(async () => {
      const { id, ...params } = args;
      const data = await adminApiRequest("labels", { id, params });
      return validateSelectable(labelSchema, data.labels?.[0] ?? data);
    })
  );

  server.tool("labels_add", addParams, async (args) =>
    runTool(async () => validateWriteEnvelope(labelSchema, await adminApiRequest("labels", { method: "POST", body: args }), "labels"))
  );

  server.tool("labels_edit", editParams, async (args) =>
    runTool(async () => {
      const { id, ...body } = args;
      return validateWriteEnvelope(labelSchema, await adminApiRequest("labels", { method: "PUT", id, body }), "labels");
    })
  );

  server.tool("labels_delete", deleteParams, async (args) =>
    runTool(async () => {
      await adminApiRequest("labels", { method: "DELETE", id: args.id });
      return `Label with id ${args.id} deleted.`;
    })
  );
}
