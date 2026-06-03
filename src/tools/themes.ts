// src/tools/themes.ts
// Theme upload and activation via the official client. Upload accepts a local
// .zip path or a remote URL; activate takes the theme name.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { runTool } from "./helpers";
import { resolveUploadFile, cleanupTempFile } from "../fileUpload";

const uploadParams = {
  file_path: z
    .string()
    .optional()
    .describe("Absolute path to a local theme .zip on the machine running this server."),
  url: z.string().optional().describe("URL of a theme .zip to download and upload."),
};
const activateParams = {
  name: z.string().describe("Name of the theme to activate (its package/folder name)."),
};

export function registerThemeTools(server: McpServer) {
  server.tool("themes_upload", uploadParams, async (args) =>
    runTool(async () => {
      const file = await resolveUploadFile(args.file_path, args.url);
      try {
        return await ghostApiClient.themes.upload({ file: file.path });
      } finally {
        cleanupTempFile(file);
      }
    })
  );

  server.tool("themes_activate", activateParams, async (args) =>
    runTool(() => ghostApiClient.themes.activate(args.name))
  );
}
