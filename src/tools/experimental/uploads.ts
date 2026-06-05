// src/tools/experimental/uploads.ts
// [experimental] Media and file uploads via the official client
// (POST /media/upload/, POST /files/upload/). Both accept a local file path or a
// remote URL (downloaded server-side under the SSRF guard, then uploaded).
// Authenticate with the Custom Integration key.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../../ghostApi";
import { validateEntity, imageSchema } from "../../schemas";
import { runTool } from "../helpers";
import { resolveUploadFile, cleanupTempFile } from "../../fileUpload";

const mediaParams = {
  file_path: z.string().optional().describe("Absolute path to a local media file (mp4, mp3, …)."),
  url: z.string().url().optional().describe("URL of a media file to download then upload."),
  ref: z.string().optional().describe("Optional reference string returned with the upload."),
};
const fileParams = {
  file_path: z.string().optional().describe("Absolute path to a local file to upload."),
  url: z.string().url().optional().describe("URL of a file to download then upload."),
  ref: z.string().optional().describe("Optional reference string returned with the upload."),
};

export function registerUploadTools(server: McpServer) {
  server.tool("media_upload", mediaParams, async (args) =>
    runTool(async () => {
      const file = await resolveUploadFile(args.file_path, args.url);
      try {
        return validateEntity(imageSchema, await ghostApiClient.media.upload({ file: file.path, ref: args.ref }));
      } finally {
        cleanupTempFile(file);
      }
    })
  );

  server.tool("files_upload", fileParams, async (args) =>
    runTool(async () => {
      const file = await resolveUploadFile(args.file_path, args.url);
      try {
        return validateEntity(imageSchema, await ghostApiClient.files.upload({ file: file.path, ref: args.ref }));
      } finally {
        cleanupTempFile(file);
      }
    })
  );
}
