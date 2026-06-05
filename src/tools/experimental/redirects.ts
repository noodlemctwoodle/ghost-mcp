// src/tools/experimental/redirects.ts
// [experimental] Download and replace URL redirects (/redirects/download/,
// /redirects/upload/). Staff-only. Upload REPLACES the entire redirect set, so it
// is confirmation-gated: without confirm:true it returns a summary and writes
// nothing.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest, adminApiUpload } from "../../ghostAdminClient";
import { runTool } from "../helpers";
import { confirmationRequired } from "./confirm";

const uploadParams = {
  redirects: z
    .array(
      z.object({
        from: z.string().describe("Path or regex to match, e.g. '/old-post'."),
        to: z.string().describe("Destination URL or path, e.g. '/new-post'."),
        permanent: z.boolean().optional().describe("true → 301 permanent, false/omitted → 302 temporary."),
      })
    )
    .describe("The COMPLETE set of redirects. This REPLACES all existing redirects — include every redirect you want to keep."),
  confirm: z.boolean().optional().describe("Must be true to apply. Omit for a dry run that writes nothing."),
};

export function registerRedirectTools(server: McpServer) {
  server.tool("redirects_download", {}, async () =>
    runTool(async () => await adminApiRequest("redirects/download", { staff: true }))
  );

  server.tool("redirects_upload", uploadParams, async (args) =>
    runTool(async () => {
      const redirects = args.redirects ?? [];
      if (args.confirm !== true) {
        const lines = redirects.map((r) => `  • ${r.from} → ${r.to} (${r.permanent ? "301" : "302"})`).join("\n");
        return confirmationRequired(
          `redirects_upload would REPLACE all existing redirects with these ${redirects.length}:\n${lines}`
        );
      }
      return await adminApiUpload("redirects/upload", {
        field: "redirects",
        filename: "redirects.json",
        contentType: "application/json",
        data: JSON.stringify(redirects),
        staff: true,
      });
    })
  );
}
