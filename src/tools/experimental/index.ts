// src/tools/experimental/index.ts
// Registers the experimental, undocumented-endpoint tools. Called only when
// GHOST_MCP_EXPERIMENTAL is enabled. These hit Ghost Admin API endpoints the
// official @tryghost/admin-api client doesn't model; they are verified working
// against Ghost v6 but are unsupported and may break across Ghost upgrades.
//
// Token routing (matches the dual-token boundary of the core tools):
//  - Integration key: config_read, settings_read, media_upload, files_upload,
//    members_import.
//  - Staff Access Token: settings_edit, snippets_*, redirects_*, themes_delete.
// Destructive config writes (settings_edit, redirects_upload, themes_delete) are
// confirmation-gated.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerConfigTools } from "./config";
import { registerSettingsTools } from "./settings";
import { registerUploadTools } from "./uploads";
import { registerMembersImportTools } from "./membersImport";
import { registerSnippetTools } from "./snippets";
import { registerRedirectTools } from "./redirects";
import { registerExperimentalThemeTools } from "./themes";

export function registerExperimentalTools(server: McpServer) {
  registerConfigTools(server);
  registerSettingsTools(server);
  registerUploadTools(server);
  registerMembersImportTools(server);
  registerSnippetTools(server);
  registerRedirectTools(server);
  registerExperimentalThemeTools(server);
}
