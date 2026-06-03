// src/security.ts
// SSRF protection for server-side URL fetches. When a tool downloads a remote
// URL (image/theme uploads), the model controls that URL — so we must refuse
// requests to internal/private addresses (loopback, RFC 1918, link-local, cloud
// metadata, etc.) before fetching.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { GhostError } from "./ghostError";

// True if an IP literal falls in a private, loopback, link-local or otherwise
// non-public range (IPv4 and IPv6, including IPv4-mapped IPv6).
export function isPrivateAddress(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true; // this-host, RFC1918, loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  const ip6 = ip.toLowerCase();
  if (ip6 === "::1" || ip6 === "::") return true; // loopback / unspecified
  if (ip6.startsWith("::ffff:")) return isPrivateAddress(ip6.slice(7)); // IPv4-mapped
  if (ip6.startsWith("fc") || ip6.startsWith("fd")) return true; // unique local
  if (ip6.startsWith("fe80")) return true; // link-local
  return false;
}

// Throw a GhostError unless `rawUrl` is an http(s) URL that resolves only to
// public addresses. Call this before any server-side fetch of a model-supplied URL.
export async function assertSafePublicUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new GhostError(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new GhostError(`Only http and https URLs are allowed (got "${url.protocol}").`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new GhostError(`Refusing to fetch an internal host: ${host}`);
  }

  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((entry) => entry.address);
    } catch {
      throw new GhostError(`Could not resolve host: ${host}`);
    }
  }

  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new GhostError(
        `Refusing to fetch "${host}" — it resolves to a private or internal address.`
      );
    }
  }
}
