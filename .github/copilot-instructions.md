# Copilot instructions for ghost-mcp

ghost-mcp is a TypeScript MCP server over the Ghost Admin API. It holds live Ghost
Admin credentials (an integration key, and optionally a high-privilege staff token)
and acts on a production Ghost site on behalf of an LLM, so it is security-sensitive.

## Architecture
- Tools live in `src/tools/`; opt-in experimental tools in `src/tools/experimental/`.
- `@tryghost/admin-api` plus a thin direct client (`src/ghostAdminClient.ts`) for
  endpoints the official client omits. `runTool()` wraps every handler and converts
  thrown errors into clean `GhostError` results.
- Every tool validates its response with a zod helper from `src/schemas.ts`.

## When reviewing a PR, prioritise
1. Credentials never leak. No key/token/JWT can reach stdout/stderr; new output must
   pass through the redaction layer (`src/redaction.ts`). Flag new `console.*`, raw
   error printing, or catches that log axios errors (they carry the auth header).
2. No SSRF. Outbound requests built from user/model input must use
   `assertSafePublicUrl` + `guardedAgents` (`src/security.ts`): public hosts only, no
   redirects, size/time caps.
3. Token routing & gating. Staff-only endpoints route with `staff: true`. Destructive
   config writes (`settings_edit`, `redirects_upload`, `themes_delete`) keep their
   confirmation gate (`confirmationRequired`).
4. Response validation. New tools validate output (writes -> `validateWriteEnvelope`/
   `validateEntity`; browse/read -> the field-tolerant validators). Flag raw returns.
5. No secrets in the repo. No real API keys, tokens, or production hostnames in code,
   tests, fixtures, or docs. Test keys are obviously fake.

## Conventions
- Tool names are `<resource>_<verb>`; read-only tools end in `_browse`/`_read`/
  `_download` (the registration policy classifies on that suffix).
- Tests use `node:test` (`test/*.test.js`, offline, run in CI). The live E2E suite is
  gated by `GHOST_DEVELOPMENT=true` (default off) and never uses real credentials.
- If `package.json` version changes, `package-lock.json` must match (root and
  `packages[""]`).
- Commits follow Conventional Commits (`feat`/`fix`/`refactor`/`test`/`docs`/`chore`
  + scope) with detailed bodies. Do not add AI/assistant attribution or
  `Co-Authored-By` trailers.
- Prose: British English, avoid em-dashes.
