#!/usr/bin/env node

// MUST be the first import: installs credential redaction on stdout/stderr before
// any other module (Admin API clients, MCP SDK) can produce output.
import "./bootstrapRedaction";

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    handleUserResource,
    handleMemberResource,
    handleTierResource,
    handleOfferResource,
    handleNewsletterResource,
    handlePostResource,
    handlePageResource,
    handleBlogInfoResource
} from "./resources";
import { registerPostTools } from "./tools/posts";
import { registerPageTools } from "./tools/pages";
import { registerMemberTools } from "./tools/members";
import { registerUserTools } from "./tools/users";
import { registerTagTools } from "./tools/tags";
import { registerTierTools } from "./tools/tiers";
import { registerOfferTools } from "./tools/offers";
import { registerNewsletterTools } from "./tools/newsletters";
import { registerInviteTools } from "./tools/invites";
import { registerRoleTools } from "./tools/roles";
import { registerWebhookTools } from "./tools/webhooks";
import { registerLabelTools } from "./tools/labels";
import { registerImageTools } from "./tools/images";
import { registerThemeTools } from "./tools/themes";
import { registerSiteTools } from "./tools/site";
import { registerExperimentalTools } from "./tools/experimental";
import { withToolPolicy } from "./tools/policy";
import { GHOST_MCP_EXPERIMENTAL, GHOST_MCP_READONLY } from "./config";
import { registerPrompts } from "./prompts";

// Read the version from package.json so it stays in sync with releases.
// require() resolves relative to the compiled file, which sits alongside
// package.json in both the dev build and the published package.
const { version } = require("../package.json");

// Create an MCP server instance
const server = new McpServer({
    name: "ghost-mcp-ts",
    version,
}, {
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
        logging: {}
    }
});

// Register resource handlers
server.resource("user", new ResourceTemplate("user://{user_id}", { list: undefined }), handleUserResource);
server.resource("member", new ResourceTemplate("member://{member_id}", { list: undefined }), handleMemberResource);
server.resource("tier", new ResourceTemplate("tier://{tier_id}", { list: undefined }), handleTierResource);
server.resource("offer", new ResourceTemplate("offer://{offer_id}", { list: undefined }), handleOfferResource);
server.resource("newsletter", new ResourceTemplate("newsletter://{newsletter_id}", { list: undefined }), handleNewsletterResource);
server.resource("post", new ResourceTemplate("post://{post_id}", { list: undefined }), handlePostResource);
server.resource("page", new ResourceTemplate("page://{page_id}", { list: undefined }), handlePageResource);
server.resource("blog-info", "blog://info", handleBlogInfoResource);

// Register tools. The policy wrapper applies GHOST_MCP_READONLY (write tools
// skipped) and GHOST_MCP_DISABLED_TOOLS (named tools skipped) at registration
// time, so the individual tool modules need no changes.
const toolServer = withToolPolicy(server);
registerPostTools(toolServer);
registerPageTools(toolServer);
registerMemberTools(toolServer);
registerUserTools(toolServer);
registerTagTools(toolServer);
registerTierTools(toolServer);
registerOfferTools(toolServer);
registerNewsletterTools(toolServer);
registerInviteTools(toolServer);
registerRoleTools(toolServer);
registerWebhookTools(toolServer);
registerLabelTools(toolServer);
registerImageTools(toolServer);
registerThemeTools(toolServer);
registerSiteTools(toolServer);

// Opt-in experimental tools (undocumented endpoints). Off unless enabled.
if (GHOST_MCP_EXPERIMENTAL) {
    registerExperimentalTools(toolServer);
}

if (GHOST_MCP_READONLY) console.error("[ghost-mcp] read-only mode: write tools are not registered.");
if (GHOST_MCP_EXPERIMENTAL) console.error("[ghost-mcp] experimental tools enabled (undocumented endpoints).");

// Register prompts
registerPrompts(server);

// Set up and connect to the standard I/O transport
async function startServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Ghost MCP TypeScript Server running on stdio"); // Log to stderr
}

// Start the server
startServer().catch((error: any) => {
    console.error("Fatal error starting server:", error);
    process.exit(1);
});
