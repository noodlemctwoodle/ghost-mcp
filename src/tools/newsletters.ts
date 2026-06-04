// src/tools/newsletters.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { validateEntity, validateSelectable, validateSelectableList, newsletterSchema } from "../schemas";
import { runTool, browseParams, selectionParams } from "./helpers";

const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
  ...selectionParams,
};
const addParams = {
  name: z.string(),
  description: z.string().optional(),
  sender_reply_to: z.string().optional(),
  status: z.string().optional(),
  subscribe_on_signup: z.boolean().optional(),
  show_header_icon: z.boolean().optional(),
  show_header_title: z.boolean().optional(),
  show_header_name: z.boolean().optional(),
  title_font_category: z.string().optional(),
  title_alignment: z.string().optional(),
  show_feature_image: z.boolean().optional(),
  body_font_category: z.string().optional(),
  show_badge: z.boolean().optional(),
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  sender_name: z.string().optional(),
  sender_email: z.string().optional(),
  sender_reply_to: z.string().optional(),
  status: z
    .string()
    .optional()
    .describe("'active' or 'archived'. Set 'archived' to archive the newsletter — Ghost has no hard delete."),
  subscribe_on_signup: z.boolean().optional(),
  sort_order: z.number().optional(),
  header_image: z.string().optional(),
  show_header_icon: z.boolean().optional(),
  show_header_title: z.boolean().optional(),
  title_font_category: z.string().optional(),
  title_alignment: z.string().optional(),
  show_feature_image: z.boolean().optional(),
  body_font_category: z.string().optional(),
  footer_content: z.string().optional(),
  show_badge: z.boolean().optional(),
  show_header_name: z.boolean().optional(),
};

export function registerNewsletterTools(server: McpServer) {
  server.tool("newsletters_browse", browseParams, async (args) =>
    runTool(async () => validateSelectableList(newsletterSchema, await ghostApiClient.newsletters.browse(args)))
  );

  server.tool("newsletters_read", readParams, async (args) =>
    runTool(async () => validateSelectable(newsletterSchema, await ghostApiClient.newsletters.read(args)))
  );

  server.tool("newsletters_add", addParams, async (args) =>
    runTool(async () => validateEntity(newsletterSchema, await ghostApiClient.newsletters.add(args)))
  );

  // Ghost has no hard delete for newsletters — archive one by setting
  // status:"archived" via this tool.
  server.tool("newsletters_edit", editParams, async (args) =>
    runTool(async () => validateEntity(newsletterSchema, await ghostApiClient.newsletters.edit(args)))
  );
}
