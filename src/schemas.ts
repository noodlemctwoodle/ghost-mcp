// src/schemas.ts
// Zod schemas for Ghost Admin API responses. These are intentionally lenient:
// every entity must have an `id` (so error blobs / wrong shapes are caught), the
// modelled fields are optional and typed, and `.passthrough()` keeps every other
// field Ghost returns untouched. This validates "is a real entity" and provides
// derived types without breaking when Ghost adds or omits fields.

import { z } from "zod";
import { GhostError } from "./ghostError";

const entity = z.object({ id: z.string() }).passthrough();

export const postSchema = entity.extend({
  title: z.string().optional(),
  slug: z.string().optional(),
  status: z.string().optional(),
  url: z.string().optional(),
  visibility: z.string().optional(),
  published_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export const pageSchema = postSchema;

export const tagSchema = entity.extend({
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
});

export const memberSchema = entity.extend({
  email: z.string().optional(),
  name: z.string().nullable().optional(),
  status: z.string().optional(),
  created_at: z.string().nullable().optional(),
});

export const userSchema = entity.extend({
  name: z.string().optional(),
  email: z.string().optional(),
  slug: z.string().optional(),
  status: z.string().optional(),
});

export const newsletterSchema = entity.extend({
  name: z.string().optional(),
  status: z.string().optional(),
  visibility: z.string().optional(),
});

export const tierSchema = entity.extend({
  name: z.string().optional(),
  type: z.string().optional(),
  active: z.boolean().optional(),
  currency: z.string().nullable().optional(),
  monthly_price: z.number().nullable().optional(),
  yearly_price: z.number().nullable().optional(),
});

export const offerSchema = entity.extend({
  name: z.string().optional(),
  code: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  amount: z.number().optional(),
});

export const labelSchema = entity.extend({
  name: z.string().optional(),
  slug: z.string().optional(),
});

export const roleSchema = entity.extend({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
});

export const inviteSchema = entity.extend({
  email: z.string().optional(),
  role_id: z.string().optional(),
  status: z.string().optional(),
});

export const webhookSchema = entity.extend({
  event: z.string().optional(),
  target_url: z.string().optional(),
  status: z.string().nullable().optional(),
});

// Site has no `id`; model the common fields and pass the rest through.
export const siteSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    url: z.string().optional(),
    version: z.string().optional(),
  })
  .passthrough();

// Inferred types — replace the former hand-written interfaces in models.ts.
export type Post = z.infer<typeof postSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Member = z.infer<typeof memberSchema>;
export type User = z.infer<typeof userSchema>;
export type Newsletter = z.infer<typeof newsletterSchema>;
export type Tier = z.infer<typeof tierSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type Label = z.infer<typeof labelSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Invite = z.infer<typeof inviteSchema>;
export type Webhook = z.infer<typeof webhookSchema>;
export type Site = z.infer<typeof siteSchema>;

// Validate a single entity, throwing a GhostError if the response is the wrong
// shape (e.g. missing id, or not an object at all). Unknown fields are preserved.
export function validateEntity<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new GhostError(`Unexpected Ghost response shape — ${detail}`);
  }
  return result.data;
}
