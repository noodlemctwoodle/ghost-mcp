// src/tools/policy.ts
// Applies tool-registration policy without touching individual tool files:
//  - GHOST_MCP_DISABLED_TOOLS removes named tools.
//  - GHOST_MCP_READONLY removes every write tool (keeps browse/read/download).
// Implemented as a Proxy over McpServer so the register*Tools() functions need no
// changes. The proxy only filters registration; the real server is what connects.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GHOST_MCP_READONLY, GHOST_MCP_DISABLED_TOOLS } from "../config";

// A read tool never mutates: browse/read/download fetch data, nothing else.
export function isReadOnlyToolName(name: string): boolean {
  return /(_browse|_read|_download)$/.test(name);
}

export function withToolPolicy(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== "tool") {
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (name: string, ...rest: unknown[]) => {
        if (GHOST_MCP_DISABLED_TOOLS.includes(name)) {
          console.error(`[ghost-mcp] skipping tool "${name}" (GHOST_MCP_DISABLED_TOOLS)`);
          return undefined;
        }
        if (GHOST_MCP_READONLY && !isReadOnlyToolName(name)) {
          console.error(`[ghost-mcp] skipping write tool "${name}" (GHOST_MCP_READONLY)`);
          return undefined;
        }
        // Invoke via Reflect.apply with an explicit receiver so `this` is the real
        // McpServer instance (member-access already binds it, but this is unambiguous).
        return Reflect.apply(target.tool as (...a: unknown[]) => unknown, target, [name, ...rest]);
      };
    },
  }) as McpServer;
}
