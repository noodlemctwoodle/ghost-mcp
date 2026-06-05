// src/tools/experimental/confirm.ts
// Confirmation gate for experimental tools that overwrite live site
// configuration (settings, redirects, theme deletion). Without `confirm: true`
// the tool makes NO change — it returns a human-readable summary of exactly what
// would happen and asks the caller to re-invoke with confirm:true. This is a
// deliberate second checkpoint before a destructive change reaches a real site.

export function confirmationRequired(summary: string): string {
  return [
    "⚠️ CONFIRMATION REQUIRED — no change has been made yet.",
    "",
    summary,
    "",
    'To apply this, call the tool again with the same arguments plus "confirm": true.',
  ].join("\n");
}
