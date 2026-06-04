// src/tools/pages.ts
// Pages are exposed by @tryghost/admin-api with the same interface as posts.
// Mirrors posts_* but without email-only/newsletter fields (pages aren't emailed).

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { adminApiRequest } from "../ghostAdminClient";
import { validateEntity, validateSelectable, validateSelectableList, pageSchema } from "../schemas";
import { runTool, browseParams, selectionParams, formatsParam } from "./helpers";

const pageBrowseParams = {
  ...browseParams,
  ...formatsParam,
};
const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
  ...selectionParams,
  ...formatsParam,
};
const tagRef = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
  }),
]);
const authorRef = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    slug: z.string().optional(),
    email: z.string().optional(),
  }),
]);
const pageMutableFields = {
  html: z.string().optional(),
  lexical: z.string().optional(),
  status: z.string().optional(),
  slug: z.string().optional(),
  visibility: z.string().optional(),
  // Page-specific: hide the title + feature image (e.g. for landing pages).
  // Pages do NOT have the post-only `featured` flag.
  show_title_and_feature_image: z.boolean().optional(),
  published_at: z.string().optional(),
  custom_excerpt: z.string().optional(),
  feature_image: z.string().optional(),
  feature_image_alt: z.string().optional(),
  feature_image_caption: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  og_title: z.string().optional(),
  og_description: z.string().optional(),
  og_image: z.string().optional(),
  twitter_title: z.string().optional(),
  twitter_description: z.string().optional(),
  twitter_image: z.string().optional(),
  codeinjection_head: z.string().optional(),
  codeinjection_foot: z.string().optional(),
  canonical_url: z.string().optional(),
  custom_template: z
    .string()
    .optional()
    .describe("Page 'Template' setting — a custom template name supplied by the active theme (e.g. 'custom-landing')."),
  tags: z.array(tagRef).optional(),
  authors: z.array(authorRef).optional(),
};
const addParams = {
  title: z.string(),
  ...pageMutableFields,
};
const editParams = {
  id: z.string(),
  updated_at: z.string(),
  title: z.string().optional(),
  ...pageMutableFields,
};
const deleteParams = {
  id: z.string(),
};

export function registerPageTools(server: McpServer) {
  server.tool("pages_browse", pageBrowseParams, async (args) =>
    runTool(async () => validateSelectableList(pageSchema, await ghostApiClient.pages.browse(args)))
  );

  server.tool("pages_read", readParams, async (args) =>
    runTool(async () => validateSelectable(pageSchema, await ghostApiClient.pages.read(args)))
  );

  server.tool("pages_add", addParams, async (args) =>
    runTool(async () => {
      const options = args.html ? { source: "html" } : undefined;
      return validateEntity(pageSchema, await ghostApiClient.pages.add(args, options));
    })
  );

  server.tool("pages_edit", editParams, async (args) =>
    runTool(async () => {
      const options = args.html ? { source: "html" } : undefined;
      return validateEntity(pageSchema, await ghostApiClient.pages.edit(args, options));
    })
  );

  server.tool("pages_delete", deleteParams, async (args) =>
    runTool(async () => {
      await ghostApiClient.pages.delete(args);
      return `Page with id ${args.id} deleted.`;
    })
  );

  // Copy is a documented endpoint not exposed by @tryghost/admin-api:
  // POST /pages/{id}/copy/ creates a draft duplicate.
  server.tool("pages_copy", { id: z.string() }, async (args) =>
    runTool(async () => {
      const data = await adminApiRequest("pages", { method: "POST", id: args.id, action: "copy" });
      const copy = data.pages?.[0];
      return copy ? validateEntity(pageSchema, copy) : data;
    })
  );
}
