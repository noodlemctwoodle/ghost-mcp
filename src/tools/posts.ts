// src/tools/posts.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { adminApiRequest } from "../ghostAdminClient";
import { validateEntity, validateSelectable, validateSelectableList, postSchema } from "../schemas";
import { runTool, browseParams, selectionParams, formatsParam } from "./helpers";

// Browse accepts the standard list controls plus content-format selection.
const postBrowseParams = {
  ...browseParams,
  ...formatsParam,
};
const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
  ...selectionParams,
  ...formatsParam,
};
// Shared mutable post fields — accepted by both posts_add and posts_edit.
// Mirrors the Ghost Admin API post resource:
// https://ghost.org/docs/admin-api/#the-post-object
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
const postMutableFields = {
  html: z.string().optional(),
  lexical: z.string().optional(),
  status: z.string().optional(),
  slug: z.string().optional(),
  visibility: z.string().optional(),
  featured: z.boolean().optional(),
  email_only: z.boolean().optional(),
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
    .describe("Post 'Template' setting — a custom template name supplied by the active theme (e.g. 'custom-landing')."),
  tags: z.array(tagRef).optional(),
  authors: z.array(authorRef).optional(),
};
const addParams = {
  title: z.string(),
  ...postMutableFields,
};
const editParams = {
  id: z.string(),
  updated_at: z.string(),
  title: z.string().optional(),
  ...postMutableFields,
};
const deleteParams = {
  id: z.string(),
};

export function registerPostTools(server: McpServer) {
  server.tool("posts_browse", postBrowseParams, async (args) =>
    runTool(async () => validateSelectableList(postSchema, await ghostApiClient.posts.browse(args)))
  );

  server.tool("posts_read", readParams, async (args) =>
    runTool(async () => validateSelectable(postSchema, await ghostApiClient.posts.read(args)))
  );

  server.tool("posts_add", addParams, async (args) =>
    runTool(async () => {
      // source: "html" tells Ghost to import from the html field
      const options = args.html ? { source: "html" } : undefined;
      return validateEntity(postSchema, await ghostApiClient.posts.add(args, options));
    })
  );

  server.tool("posts_edit", editParams, async (args) =>
    runTool(async () => {
      const options = args.html ? { source: "html" } : undefined;
      return validateEntity(postSchema, await ghostApiClient.posts.edit(args, options));
    })
  );

  server.tool("posts_delete", deleteParams, async (args) =>
    runTool(async () => {
      await ghostApiClient.posts.delete(args);
      return `Post with id ${args.id} deleted.`;
    })
  );

  // Copy is a documented endpoint not exposed by @tryghost/admin-api:
  // POST /posts/{id}/copy/ creates a draft duplicate.
  server.tool("posts_copy", { id: z.string() }, async (args) =>
    runTool(async () => {
      const data = await adminApiRequest("posts", { method: "POST", id: args.id, action: "copy" });
      const copy = data.posts?.[0];
      return copy ? validateEntity(postSchema, copy) : data;
    })
  );
}
