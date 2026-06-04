#!/usr/bin/env node

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

// Register tools
registerPostTools(server);
registerPageTools(server);
registerMemberTools(server);
registerUserTools(server);
registerTagTools(server);
registerTierTools(server);
registerOfferTools(server);
registerNewsletterTools(server);
registerInviteTools(server);
registerRoleTools(server);
registerWebhookTools(server);
registerLabelTools(server);
registerImageTools(server);
registerThemeTools(server);
registerSiteTools(server);

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
