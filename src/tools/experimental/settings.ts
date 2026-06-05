// src/tools/experimental/settings.ts
// [experimental] Read and edit site settings (GET/PUT /settings/). Reading uses
// the Custom Integration key; editing requires a Staff Access Token (the
// integration key gets 403). Every edit is confirmation-gated: without
// confirm:true it returns the exact diff and writes nothing.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { adminApiRequest } from "../../ghostAdminClient";
import { validateEntityList, settingSchema } from "../../schemas";
import { GHOST_STAFF_TOKEN } from "../../config";
import { GhostError } from "../../ghostError";
import { runTool } from "../helpers";
import { confirmationRequired } from "./confirm";

const editParams = {
  updates: z
    .record(z.string(), z.unknown())
    .describe(
      'Object of setting key → new value, e.g. { "title": "My Blog", "description": "..." }. Keys must match Ghost setting keys (run settings_read to see them).'
    ),
  confirm: z
    .boolean()
    .optional()
    .describe("Must be true to apply. Omit (or false) for a dry run that returns the exact diff and writes nothing."),
};

export function registerSettingsTools(server: McpServer) {
  server.tool("settings_read", {}, async () =>
    runTool(async () => {
      const data = await adminApiRequest("settings");
      const settings = data.settings ?? [];
      validateEntityList(settingSchema, settings);
      return settings;
    })
  );

  server.tool("settings_edit", editParams, async (args) =>
    runTool(async () => {
      const updates = args.updates ?? {};
      const keys = Object.keys(updates);
      if (keys.length === 0) return "No updates provided — nothing to change.";

      const current = await adminApiRequest("settings");
      const currentMap = new Map<string, unknown>(
        (current.settings ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value])
      );
      const diff = keys
        .map((key) => {
          const before = currentMap.has(key) ? JSON.stringify(currentMap.get(key)) : "(unset)";
          const after = JSON.stringify(updates[key]);
          const warn = currentMap.has(key) ? "" : "  ⚠️ not a known setting key";
          return `  • ${key}: ${before} → ${after}${warn}`;
        })
        .join("\n");

      if (args.confirm !== true) {
        return confirmationRequired(`settings_edit would change ${keys.length} setting(s) on the live site:\n${diff}`);
      }
      if (!GHOST_STAFF_TOKEN) {
        throw new GhostError(
          "Editing settings requires a Staff Access Token (set GHOST_STAFF_TOKEN). The Custom Integration key cannot write settings."
        );
      }

      const payload = keys.map((key) => ({ key, value: updates[key] }));
      const data = await adminApiRequest("settings", { method: "PUT", bodyArray: payload, staff: true });
      const settings = data.settings ?? [];
      validateEntityList(settingSchema, settings);
      return { updated: keys, settings };
    })
  );
}
