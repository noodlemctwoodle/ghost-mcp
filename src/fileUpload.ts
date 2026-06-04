// src/fileUpload.ts
// Resolve an upload input (a local file path or a remote URL) to a local file
// path that the @tryghost/admin-api upload methods can stream. Remote URLs are
// downloaded into a private temp directory that the caller cleans up.

import axios from "axios";
import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, basename } from "node:path";
import { GhostError } from "./ghostError";
import { assertSafePublicUrl, guardedAgents } from "./security";

export interface ResolvedFile {
  path: string;
  // A temp directory to remove on cleanup (set only for downloaded URLs).
  cleanupDir?: string;
}

export async function resolveUploadFile(filePath?: string, url?: string): Promise<ResolvedFile> {
  if (filePath) {
    if (!existsSync(filePath)) {
      throw new GhostError(`Local file not found: ${filePath}`);
    }
    return { path: filePath };
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
      // Validate the resolved IP at connect time too — closes the DNS-rebinding
      // window between assertSafePublicUrl and the actual fetch.
      ...guardedAgents(),
    });
    // Derive a safe single-segment filename. basename strips any directory; the
    // guard rejects empty/dot/separator names so a URL can never steer the write
    // outside the private temp dir.
    let name = basename(new URL(url).pathname);
    if (!name || name === "." || name === ".." || /[\\/]/.test(name)) {
      name = "upload";
    }
    if (!extname(name)) {
      name += ".bin";
    }
    // mkdtemp creates a uniquely-named, 0700 directory — avoids the predictable
    // shared-/tmp filename that is vulnerable to symlink/race attacks.
    const dir = mkdtempSync(join(tmpdir(), "ghost-mcp-"));
    const tmp = join(dir, name);
    writeFileSync(tmp, Buffer.from(response.data));
    return { path: tmp, cleanupDir: dir };
  }

  throw new GhostError("Provide either a local file path or a URL to upload.");
}

export function cleanupTempFile(file: ResolvedFile): void {
  if (file.cleanupDir) {
    try {
      rmSync(file.cleanupDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup; ignore failures
    }
  }
}
