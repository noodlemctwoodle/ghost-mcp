// src/ghostError.ts
// Normalises errors from the Ghost Admin API — whether they come from the
// official @tryghost/admin-api client or from direct axios calls — into a
// single GhostError type and a clear, user-facing message.

import { redactSecrets } from "./redaction";

export class GhostError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly context?: string;

  constructor(
    message: string,
    details: { statusCode?: number; code?: string; context?: string } = {}
  ) {
    super(message);
    this.name = "GhostError";
    this.statusCode = details.statusCode;
    this.code = details.code;
    this.context = details.context;
  }
}

// Convert any thrown value into a GhostError with the most useful message we can
// extract. Handles the Ghost API error envelope ({ errors: [{ message, ... }] }),
// HTTP status codes, and low-level network failures.
export function toGhostError(error: unknown): GhostError {
  if (error instanceof GhostError) {
    return error;
  }

  const err = error as {
    message?: string;
    code?: string;
    statusCode?: number;
    context?: string;
    type?: string;
    errors?: Array<Record<string, unknown>>;
    response?: { status?: number; data?: { errors?: Array<Record<string, unknown>> } };
  };

  const status = err?.response?.status ?? err?.statusCode;
  const apiError = err?.response?.data?.errors?.[0] ?? err?.errors?.[0];

  if (apiError) {
    return new GhostError(String(apiError.message ?? "Ghost API error"), {
      statusCode: status,
      code: String(apiError.code ?? apiError.type ?? ""),
      context: apiError.context ? String(apiError.context) : undefined,
    });
  }

  if (status === 401 || status === 403) {
    return new GhostError(
      `Request was not authorised (HTTP ${status}). Check GHOST_ADMIN_API_KEY is the Admin API key in {id}:{secret} form (not the Content API key). Note: staff-only operations (users_edit/delete, invites_browse/delete) require GHOST_STAFF_TOKEN — a Custom Integration key returns 403 for those.`,
      { statusCode: status }
    );
  }
  if (status === 404) {
    return new GhostError("Not found — the requested resource does not exist.", {
      statusCode: 404,
    });
  }
  if (err?.code === "ENOTFOUND" || err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT") {
    return new GhostError(
      `Cannot reach Ghost at the configured GHOST_API_URL (${err.code}). Check the URL is correct and reachable.`,
      { code: err.code }
    );
  }

  return new GhostError(err?.message ?? "Unknown error communicating with Ghost.", {
    statusCode: status,
    code: err?.code,
  });
}

// Produce a single human-readable string for returning in an MCP tool error
// result. Redacted as a second layer in case any field ever carries a secret —
// the I/O-boundary redactor (src/redaction.ts) is the primary guarantee.
export function formatGhostError(error: unknown): string {
  const e = toGhostError(error);
  const lines = [`Ghost API error: ${e.message}`];
  if (e.context) {
    lines.push(`Context: ${e.context}`);
  }
  if (e.statusCode) {
    lines.push(`HTTP status: ${e.statusCode}`);
  }
  return redactSecrets(lines.join("\n"));
}
