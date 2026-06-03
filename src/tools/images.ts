// src/tools/images.ts
// Image upload via the official client (POST /images/upload/). Accepts a local
// file path or a remote URL (downloaded server-side, then uploaded).

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { runTool } from "./helpers";
import { resolveUploadFile, cleanupTempFile } from "../fileUpload";

const uploadParams = {
  file_path: z
    .string()
    .optional()
    .describe("Absolute path to a local image file on the machine running this server."),
  url: z
    .string()
    .url()
    .optional()
    .describe("URL of an image to download and upload to Ghost. Use this when you don't have a local file."),
  purpose: z
    .string()
    .optional()
    .describe("Image purpose: 'image' (default), 'profile_image', or 'icon'."),
  ref: z.string().optional().describe("Optional reference string returned with the uploaded image."),
};

export function registerImageTools(server: McpServer) {
  server.tool("images_upload", uploadParams, async (args) =>
    runTool(async () => {
      const file = await resolveUploadFile(args.file_path, args.url);
      try {
        return await ghostApiClient.images.upload({
          file: file.path,
          purpose: args.purpose,
          ref: args.ref,
        });
      } finally {
        cleanupTempFile(file);
      }
    })
  );
}
