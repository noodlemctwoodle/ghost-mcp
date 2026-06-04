// src/tools/tags.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { validateEntity, validateSelectable, validateSelectableList, tagSchema } from "../schemas";
import { runTool, browseParams, selectionParams } from "./helpers";

const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
  ...selectionParams,
};
const addParams = {
  name: z.string(),
  description: z.string().optional(),
  slug: z.string().optional(),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerTagTools(server: McpServer) {
  server.tool("tags_browse", browseParams, async (args) =>
    runTool(async () => validateSelectableList(tagSchema, await ghostApiClient.tags.browse(args)))
  );

  server.tool("tags_read", readParams, async (args) =>
    runTool(async () => validateSelectable(tagSchema, await ghostApiClient.tags.read(args)))
  );

  server.tool("tags_add", addParams, async (args) =>
    runTool(async () => validateEntity(tagSchema, await ghostApiClient.tags.add(args)))
  );

  server.tool("tags_edit", editParams, async (args) =>
    runTool(async () => validateEntity(tagSchema, await ghostApiClient.tags.edit(args)))
  );

  server.tool("tags_delete", deleteParams, async (args) =>
    runTool(async () => {
      await ghostApiClient.tags.delete(args);
      return `Tag with id ${args.id} deleted.`;
    })
  );
}
