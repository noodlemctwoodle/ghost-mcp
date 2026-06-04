// src/tools/helpers.ts
// Shared helpers for tool handlers: a uniform result/error wrapper and reusable
// Zod parameter fragments.

import { z } from "zod";
import { formatGhostError } from "../ghostError";

type TextToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

// Run a tool's work and format the outcome consistently:
//  - a returned string is used as-is (e.g. "Post deleted.")
//  - any other value is pretty-printed as JSON
//  - thrown errors become a clean MCP error result instead of crashing the call
export async function runTool(
  exec: () => Promise<unknown> | unknown
): Promise<TextToolResult> {
  try {
    const result = await exec();
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return { content: [{ type: "text", text }] };
  } catch (error) {
    return { content: [{ type: "text", text: formatGhostError(error) }], isError: true };
  }
}

// Field/relation selectors accepted by all Ghost endpoints. Exposed on read and
// browse tools so callers can trim large responses instead of pulling everything.
export const selectionParams = {
  fields: z
    .string()
    .optional()
    .describe(
      "Comma-separated list of fields to return, e.g. 'id,title,status,url'. Use this to avoid very large responses."
    ),
  include: z
    .string()
    .optional()
    .describe("Comma-separated related data to include, e.g. 'tags,authors'."),
};

// Standard browse controls plus selection params.
export const browseParams = {
  filter: z.string().optional().describe("Ghost filter expression, e.g. \"status:published\"."),
  limit: z.number().optional().describe("Max items to return (number, or use a large value for all)."),
  page: z.number().optional().describe("Page number for pagination."),
  order: z.string().optional().describe("Sort order, e.g. 'published_at desc'."),
  ...selectionParams,
};

// Content render formats — relevant to posts/pages only. Defaults to Ghost's
// behaviour (mobiledoc + lexical), which is large; set this to 'html' or use
// `fields` to keep responses small.
export const formatsParam = {
  formats: z
    .string()
    .optional()
    .describe(
      "Comma-separated content formats to return: 'html', 'plaintext', 'mobiledoc', 'lexical'. Defaults to mobiledoc+lexical (large) — set 'html' or use `fields` to reduce size."
    ),
};

// Fields kept in the compact confirmation returned by post/page write tools.
const WRITE_SUMMARY_FIELDS = [
  "id",
  "uuid",
  "title",
  "slug",
  "status",
  "url",
  "visibility",
  "published_at",
  "updated_at",
] as const;

// Reduce a created/updated entity to a small confirmation object for write tools
// (add/edit/copy). A post or page response carries the full `lexical`, `html` and
// `mobiledoc` body, which can exceed an MCP client's response-size limit even
// though the write succeeded. Callers that need the whole record read it back with
// the matching *_read tool. A value that isn't an object, or has none of the
// summary fields, is returned unchanged.
export function summarizeWrite(entity: unknown): unknown {
  if (!entity || typeof entity !== "object") return entity;
  const source = entity as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const key of WRITE_SUMMARY_FIELDS) {
    if (source[key] !== undefined) summary[key] = source[key];
  }
  return Object.keys(summary).length > 0 ? summary : entity;
}
