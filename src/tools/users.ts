// src/tools/users.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { runTool, browseParams, selectionParams } from "./helpers";

const readParams = {
  id: z.string().optional(),
  email: z.string().optional(),
  slug: z.string().optional(),
  ...selectionParams,
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  slug: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
};
const deleteParams = {
  id: z.string(),
};

export function registerUserTools(server: McpServer) {
  server.tool("users_browse", browseParams, async (args) =>
    runTool(() => ghostApiClient.users.browse(args))
  );

  server.tool("users_read", readParams, async (args) =>
    runTool(() => ghostApiClient.users.read(args))
  );

  server.tool("users_edit", editParams, async (args) =>
    runTool(() => ghostApiClient.users.edit(args))
  );

  server.tool("users_delete", deleteParams, async (args) =>
    runTool(async () => {
      await ghostApiClient.users.delete(args);
      return `User with id ${args.id} deleted.`;
    })
  );
}
