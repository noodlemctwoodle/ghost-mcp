// src/ghostAdminClient.ts
// Minimal authenticated client for Ghost Admin API resources that the official
// @tryghost/admin-api package does not expose (tiers, offers, roles, invites).
//
// Auth mirrors @tryghost/admin-api exactly: an HS256 JWT signed with the hex
// secret half of the Admin API key, with the key id as the `kid` header and the
// admin API prefix as the audience. The token is short-lived (5 minutes) and
// regenerated per request.

import axios from "axios";
import { createHmac } from "node:crypto";
import { GHOST_API_URL, GHOST_ADMIN_API_KEY, GHOST_API_VERSION } from "./config";
import { toGhostError } from "./ghostError";

// Resolve the Admin API path/audience prefix for a given version string.
// Only v2–v4/canary carry a version segment; v5+ uses a bare `/admin/`.
function adminPrefix(version: string): string {
  if (version === "v2" || version === "v3" || version === "v4" || version === "canary") {
    return `/${version}/admin/`;
  }
  const match = /^(v[2-4])\.\d+/.exec(version);
  if (match) {
    return `/${match[1]}/admin/`;
  }
  return "/admin/";
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function generateToken(): string {
  const [id, secret] = GHOST_ADMIN_API_KEY.split(":");
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }));
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iat: issuedAt,
      exp: issuedAt + 300,
      aud: adminPrefix(GHOST_API_VERSION),
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

const baseUrl = GHOST_API_URL.replace(/\/+$/, "");

export interface AdminRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  id?: string;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

// Make a request to an Admin API resource and return the parsed response body
// (the Ghost envelope, e.g. { tiers: [...], meta: {...} }). Throws a GhostError
// on any failure.
export async function adminApiRequest(
  resource: string,
  options: AdminRequestOptions = {}
): Promise<any> {
  const { method = "GET", id, body, params } = options;
  const url = `${baseUrl}/ghost/api${adminPrefix(GHOST_API_VERSION)}${resource}/${
    id ? `${encodeURIComponent(id)}/` : ""
  }`;

  try {
    const response = await axios({
      method,
      url,
      params,
      data: body ? { [resource]: [body] } : undefined,
      headers: {
        Authorization: `Ghost ${generateToken()}`,
        "Accept-Version": GHOST_API_VERSION,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw toGhostError(error);
  }
}
