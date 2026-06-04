// src/resources.ts
// Resource handlers fetch a single entity by id and return it as validated JSON.
// Tiers and offers are not exposed by @tryghost/admin-api, so they use the direct
// Admin API client; everything else uses the official client.

import { ghostApiClient } from "./ghostApi";
import { adminApiRequest } from "./ghostAdminClient";
import { toGhostError } from "./ghostError";
import {
  validateEntity,
  postSchema,
  pageSchema,
  memberSchema,
  userSchema,
  newsletterSchema,
  tierSchema,
  offerSchema,
  siteSchema,
} from "./schemas";

// Type definitions compatible with MCP SDK resource handler expectations
type Variables = Record<string, string | string[]>;
type ReadResourceTemplateCallback = (uri: URL, variables: Variables) => Promise<any>;

function jsonContents(uri: URL, data: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify(data, null, 2),
        mimeType: "application/json",
      },
    ],
  };
}

export const handleUserResource: ReadResourceTemplateCallback = async (uri, variables) => {
  const userId = variables.user_id as string;
  if (!userId) {
    throw new Error("Missing user_id parameter");
  }
  try {
    const user = await ghostApiClient.users.read({ id: userId });
    return jsonContents(uri, validateEntity(userSchema, user));
  } catch (error) {
    throw toGhostError(error);
  }
};

export const handleMemberResource: ReadResourceTemplateCallback = async (uri, variables) => {
  const memberId = variables.member_id as string;
  if (!memberId) {
    throw new Error("Missing member_id parameter");
  }
  try {
    const member = await ghostApiClient.members.read({ id: memberId });
    return jsonContents(uri, validateEntity(memberSchema, member));
  } catch (error) {
    throw toGhostError(error);
  }
};

export const handleTierResource: ReadResourceTemplateCallback = async (uri, variables) => {
  const tierId = variables.tier_id as string;
  if (!tierId) {
    throw new Error("Missing tier_id parameter");
  }
  try {
    const data = await adminApiRequest("tiers", { id: tierId });
    return jsonContents(uri, validateEntity(tierSchema, data.tiers?.[0] ?? data));
  } catch (error) {
    throw toGhostError(error);
  }
};

export const handleOfferResource: ReadResourceTemplateCallback = async (uri, variables) => {
  const offerId = variables.offer_id as string;
  if (!offerId) {
    throw new Error("Missing offer_id parameter");
  }
  try {
    const data = await adminApiRequest("offers", { id: offerId });
    return jsonContents(uri, validateEntity(offerSchema, data.offers?.[0] ?? data));
  } catch (error) {
    throw toGhostError(error);
  }
};

export const handleNewsletterResource: ReadResourceTemplateCallback = async (uri, variables) => {
  const newsletterId = variables.newsletter_id as string;
  if (!newsletterId) {
    throw new Error("Missing newsletter_id parameter");
  }
  try {
    const newsletter = await ghostApiClient.newsletters.read({ id: newsletterId });
    return jsonContents(uri, validateEntity(newsletterSchema, newsletter));
  } catch (error) {
    throw toGhostError(error);
  }
};

export const handlePostResource: ReadResourceTemplateCallback = async (uri, variables) => {
  const postId = variables.post_id as string;
  if (!postId) {
    throw new Error("Missing post_id parameter");
  }
  try {
    // Request html only to avoid returning the large mobiledoc + lexical payloads.
    const post = await ghostApiClient.posts.read({ id: postId, formats: "html" });
    return jsonContents(uri, validateEntity(postSchema, post));
  } catch (error) {
    throw toGhostError(error);
  }
};

export const handlePageResource: ReadResourceTemplateCallback = async (uri, variables) => {
  const pageId = variables.page_id as string;
  if (!pageId) {
    throw new Error("Missing page_id parameter");
  }
  try {
    // Request html only to avoid returning the large mobiledoc + lexical payloads.
    const page = await ghostApiClient.pages.read({ id: pageId, formats: "html" });
    return jsonContents(uri, validateEntity(pageSchema, page));
  } catch (error) {
    throw toGhostError(error);
  }
};

export async function handleBlogInfoResource(uri: URL): Promise<any> {
  try {
    const site = await ghostApiClient.site.read();
    return jsonContents(uri, validateEntity(siteSchema, site));
  } catch (error) {
    throw toGhostError(error);
  }
}
