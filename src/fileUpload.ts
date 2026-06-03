// src/fileUpload.ts
// Resolve an upload input (a local file path or a remote URL) to a local file
// path that the @tryghost/admin-api upload methods can stream. Remote URLs are
// downloaded to a temp file that the caller is responsible for cleaning up.

import axios from "axios";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, basename } from "node:path";
import { GhostError } from "./ghostError";
import { assertSafePublicUrl } from "./security";

export interface ResolvedFile {
  path: string;
  isTemp: boolean;
}

export async function resolveUploadFile(filePath?: string, url?: string): Promise<ResolvedFile> {
  if (filePath) {
    if (!existsSync(filePath)) {
      throw new GhostError(`Local file not found: ${filePath}`);
    }
    return { path: filePath, isTemp: false };
  }

  if (url) {
    // Guard against SSRF: only public http(s) hosts, no redirects, bounded size/time.
    await assertSafePublicUrl(url);
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      maxRedirects: 0,
      timeout: 15000,
      maxContentLength: 25 * 1024 * 1024,
      maxBodyLength: 25 * 1024 * 1024,
    });
    let name = basename(new URL(url).pathname) || "upload";
    if (!extname(name)) {
      name += ".bin";
    }
    const tmp = join(tmpdir(), `ghost-mcp-${Date.now()}-${name}`);
    writeFileSync(tmp, Buffer.from(response.data));
    return { path: tmp, isTemp: true };
  }

  throw new GhostError("Provide either a local file path or a URL to upload.");
}

export function cleanupTempFile(file: ResolvedFile): void {
  if (file.isTemp) {
    try {
      unlinkSync(file.path);
    } catch {
      // best-effort cleanup; ignore failures
    }
  }
}
