// src/tools/experimental/membersImport.ts
// [experimental] Bulk member import via CSV (POST /members/upload/). Accepts CSV
// content inline or a local .csv path. Authenticates with the Custom Integration
// key. The CSV header must include an `email` column.

import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiUpload } from "../../ghostAdminClient";
import { GhostError } from "../../ghostError";
import { runTool } from "../helpers";

// Match the 25 MB upload cap in adminApiUpload so oversized input fails fast.
const MAX_CSV_BYTES = 25 * 1024 * 1024;

const importParams = {
  csv: z
    .string()
    .optional()
    .describe("CSV content to import. First row is a header that must include an 'email' column, e.g. 'email,name\\njane@example.com,Jane'."),
  file_path: z
    .string()
    .optional()
    .describe("Absolute path to a local .csv file to import (alternative to passing csv inline)."),
};

export function registerMembersImportTools(server: McpServer) {
  server.tool("members_import", importParams, async (args) =>
    runTool(async () => {
      let csv = args.csv;
      if (!csv && args.file_path) {
        if (!existsSync(args.file_path)) throw new GhostError(`Local file not found: ${args.file_path}`);
        csv = readFileSync(args.file_path, "utf8");
      }
      if (!csv || !csv.trim()) {
        throw new GhostError("Provide CSV content via `csv` or a local `file_path`.");
      }
      if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) {
        throw new GhostError(`CSV is too large (limit ${MAX_CSV_BYTES / 1024 / 1024} MB). Split the import into smaller files.`);
      }
      return await adminApiUpload("members/upload", {
        field: "membersfile",
        filename: "members.csv",
        contentType: "text/csv",
        data: csv,
        staff: false,
      });
    })
  );
}
