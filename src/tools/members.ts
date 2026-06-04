// src/tools/members.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { validateEntity, validateSelectable, validateSelectableList, memberSchema } from "../schemas";
import { runTool, browseParams, selectionParams } from "./helpers";

const readParams = {
  id: z.string().optional(),
  email: z.string().optional(),
  ...selectionParams,
};
const addParams = {
  email: z.string(),
  name: z.string().optional(),
  note: z.string().optional(),
  labels: z.array(z.object({ name: z.string(), slug: z.string().optional() })).optional(),
  newsletters: z.array(z.object({ id: z.string() })).optional(),
};
const editParams = {
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  note: z.string().optional(),
  labels: z.array(z.object({ name: z.string(), slug: z.string().optional() })).optional(),
  newsletters: z.array(z.object({ id: z.string() })).optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerMemberTools(server: McpServer) {
  server.tool("members_browse", browseParams, async (args) =>
    runTool(async () => validateSelectableList(memberSchema, await ghostApiClient.members.browse(args)))
  );

  server.tool("members_read", readParams, async (args) =>
    runTool(async () => validateSelectable(memberSchema, await ghostApiClient.members.read(args)))
  );

  server.tool("members_add", addParams, async (args) =>
    runTool(async () => validateEntity(memberSchema, await ghostApiClient.members.add(args)))
  );

  server.tool("members_edit", editParams, async (args) =>
    runTool(async () => validateEntity(memberSchema, await ghostApiClient.members.edit(args)))
  );

  server.tool("members_delete", deleteParams, async (args) =>
    runTool(async () => {
      await ghostApiClient.members.delete(args);
      return `Member with id ${args.id} deleted.`;
    })
  );
}
