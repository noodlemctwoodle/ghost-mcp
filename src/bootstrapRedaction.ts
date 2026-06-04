// src/bootstrapRedaction.ts
// Imported FIRST by the server entry so credential redaction is active before any
// other module runs — in particular before the Admin API clients are constructed
// (a malformed key makes @tryghost/admin-api throw at construction time, which
// would otherwise print the key to stderr unredacted). Reads the raw env directly
// rather than ./config so it has no validation/exit side effects of its own.

import { writeSync } from "node:fs";
import { installSecretRedaction, buildSecretList, redactSecrets } from "./redaction";

installSecretRedaction(
  buildSecretList([process.env.GHOST_ADMIN_API_KEY, process.env.GHOST_STAFF_TOKEN])
);

// The stdout/stderr wrapper covers normal writes (MCP responses, console.*), but
// Node prints uncaught exceptions and unhandled rejections through an internal
// path that bypasses it — and such an error can carry an axios request config with
// the Authorization header (the JWT). Catch those, redact, and exit, so no fatal
// path can leak a credential. writeSync(fd 2) is synchronous (so the message is
// flushed before exit) and we redact the string explicitly since it bypasses the
// stream wrapper.
function reportFatal(label: string, value: unknown): never {
  const detail = value instanceof Error ? value.stack || value.message : String(value);
  try {
    writeSync(2, `${label}: ${redactSecrets(detail)}\n`);
  } catch {
    // ignore — never make the failure handler itself throw
  }
  process.exit(1);
}

process.on("uncaughtException", (err) => reportFatal("Uncaught exception", err));
process.on("unhandledRejection", (reason) => reportFatal("Unhandled rejection", reason));
