// src/redaction.ts
// Defence-in-depth secret redaction.
//
// Credentials live only in the outbound `Authorization` header and are never
// intentionally serialised into tool output or logs. But "no current code path
// leaks them" is not a control — a future call site, the MCP SDK, or a
// dependency (e.g. an axios error carrying `config.headers.Authorization`) could.
// So we scrub the configured secrets from EVERY byte written to stdout/stderr.
//
// The configured key/secret never appear in legitimate JSON-RPC traffic (they
// are not in any tool argument or Ghost response), so this is a no-op in normal
// operation and cannot corrupt the protocol — it only ever fires on a leak.
//
// This module is standalone (no config import) so the secret list is supplied by
// the entry point; that keeps it pure and unit-testable.

const REDACTED = "[REDACTED]";

let activeSecrets: string[] = [];
let installed = false;

// Build the set of strings to scrub from a list of `{id}:{secret}` credentials:
// the whole credential and its HMAC secret half (the crown jewel). The id half
// is the public `kid` and shares Ghost's 24-hex ObjectId space, so it is left
// alone to avoid redacting unrelated entity ids. Trivial/short values are dropped
// so an empty or tiny value can never blank legitimate output.
export function buildSecretList(values: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    out.add(v);
    if (v.includes(":")) {
      const secret = v.split(":")[1];
      if (secret) out.add(secret);
    }
  }
  return [...out].filter((s) => s.length >= 12);
}

// Replace any supplied secret, and any Ghost JWT auth value, with a marker.
// Pure and allocation-light; safe to call on every write. Defaults to the secrets
// registered via installSecretRedaction().
export function redactSecrets(text: string, secrets: string[] = activeSecrets): string {
  let out = text;
  for (const s of secrets) {
    if (out.includes(s)) out = out.split(s).join(REDACTED);
  }
  // A Ghost Admin JWT is sent as `Authorization: Ghost <jwt>`. If an axios error
  // config ever reaches a sink, the header arrives in this exact form — scrub it.
  // The `eyJhbGciOiJIUzI1Ni…` prefix is base64url of an HS256 JWT header, which
  // does not occur in ordinary blog content.
  out = out.replace(
    /Ghost\s+eyJhbGciOiJIUzI1Ni[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    `Ghost ${REDACTED}`
  );
  out = out.replace(
    /eyJhbGciOiJIUzI1Ni[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    REDACTED
  );
  return out;
}

// Register the secrets and wrap process.stdout/stderr `write` so every chunk is
// redacted before it leaves the process. Idempotent; a no-op with no secrets.
export function installSecretRedaction(secrets: string[]): void {
  activeSecrets = secrets || [];
  if (installed || activeSecrets.length === 0) return;
  installed = true;
  for (const stream of [process.stdout, process.stderr] as const) {
    const original = stream.write.bind(stream);
    (stream as unknown as { write: (...a: any[]) => boolean }).write = (
      chunk: any,
      encoding?: any,
      callback?: any
    ): boolean => {
      try {
        if (typeof chunk === "string") {
          chunk = redactSecrets(chunk);
        } else if (Buffer.isBuffer(chunk)) {
          const s = chunk.toString("utf8");
          const r = redactSecrets(s);
          if (r !== s) chunk = Buffer.from(r, "utf8");
        }
      } catch {
        // Redaction must never break I/O — fall through with the original chunk.
      }
      return original(chunk, encoding, callback);
    };
  }
}
