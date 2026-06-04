import GhostAdminAPI from '@tryghost/admin-api';
import { GHOST_API_URL, GHOST_ADMIN_API_KEY, GHOST_API_VERSION, GHOST_STAFF_TOKEN } from './config';

// Initialize and export the Ghost Admin API client instance.
// Configuration is loaded from src/config.ts.
export const ghostApiClient = new GhostAdminAPI({
    url: GHOST_API_URL,
    key: GHOST_ADMIN_API_KEY,
    version: GHOST_API_VERSION
});

// Client authenticated with the optional Staff Access Token, used by the
// staff-management tools (users edit/delete). Falls back to the primary client
// when no staff token is configured.
export const ghostStaffClient = GHOST_STAFF_TOKEN
    ? new GhostAdminAPI({ url: GHOST_API_URL, key: GHOST_STAFF_TOKEN, version: GHOST_API_VERSION })
    : ghostApiClient;

// You can add helper functions here to wrap API calls and handle errors
// For example:
/*
export async function getPostById(postId: string): Promise<any> {
    try {
        const post = await ghostApiClient.posts.read({ id: postId });
        return post;
    } catch (error) {
        console.error(`Error fetching post ${postId}:`, error);
        throw new Error(`Failed to fetch post ${postId}`);
    }
}
*/