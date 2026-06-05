// src/tools/experimental/snippets.ts
// [experimental] Editor snippets CRUD (/snippets/). These are staff-only — every
// call authenticates with the Staff Access Token (the integration key gets 403).
// Ghost stores snippets as Mobiledoc, so content is provided as plain `text`
// (converted to a minimal Mobiledoc paragraph) or a raw `mobiledoc` JSON string.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../../ghostAdminClient";
import { GhostError } from "../../ghostError";
import { validateEnvelope, validateSelectable, validateWriteEnvelope, snippetSchema } from "../../schemas";
import { runTool, browseParams, selectionParams } from "../helpers";

const readParams = { id: z.string(), ...selectionParams };
const contentFields = {
  text: z.string().optional().describe("Plain-text content — converted to a minimal Mobiledoc paragraph. Easiest option for simple snippets."),
  mobiledoc: z
    .string()
    .optional()
    .describe("Snippet content as a Mobiledoc JSON string. Takes precedence over `text`. (Ghost stores snippets as Mobiledoc; Lexical-only is rejected.)"),
};
const addParams = { name: z.string().describe("Snippet name."), ...contentFields };
const editParams = { id: z.string(), name: z.string().optional().describe("New snippet name."), ...contentFields };
const deleteParams = { id: z.string().describe("Snippet id to delete.") };

function toMobiledoc(text: string): string {
  return JSON.stringify({ version: "0.3.1", atoms: [], cards: [], markups: [], sections: [[1, "p", [[0, [], 0, text]]]] });
}

export function registerSnippetTools(server: McpServer) {
  server.tool("snippets_browse", browseParams, async (args) =>
    runTool(async () => validateEnvelope(snippetSchema, await adminApiRequest("snippets", { params: args, staff: true }), "snippets"))
  );

  server.tool("snippets_read", readParams, async (args) =>
    runTool(async () => {
      const { id, ...params } = args;
      const data = await adminApiRequest("snippets", { id, params, staff: true });
      return validateSelectable(snippetSchema, data.snippets?.[0] ?? data);
    })
  );

  server.tool("snippets_add", addParams, async (args) =>
    runTool(async () => {
      const mobiledoc = args.mobiledoc ?? (args.text != null ? toMobiledoc(args.text) : undefined);
      if (!mobiledoc) throw new GhostError("Provide snippet content via `text` or `mobiledoc`.");
      return validateWriteEnvelope(
        snippetSchema,
        await adminApiRequest("snippets", { method: "POST", body: { name: args.name, mobiledoc }, staff: true }),
        "snippets"
      );
    })
  );

  server.tool("snippets_edit", editParams, async (args) =>
    runTool(async () => {
      const mobiledoc = args.mobiledoc ?? (args.text != null ? toMobiledoc(args.text) : undefined);
      const body: Record<string, unknown> = {};
      if (args.name != null) body.name = args.name;
      if (mobiledoc != null) body.mobiledoc = mobiledoc;
      if (Object.keys(body).length === 0) throw new GhostError("Provide a new `name`, `text`, or `mobiledoc` to edit.");
      return validateWriteEnvelope(snippetSchema, await adminApiRequest("snippets", { method: "PUT", id: args.id, body, staff: true }), "snippets");
    })
  );

  server.tool("snippets_delete", deleteParams, async (args) =>
    runTool(async () => {
      await adminApiRequest("snippets", { method: "DELETE", id: args.id, staff: true });
      return `Snippet ${args.id} deleted.`;
    })
  );
}
