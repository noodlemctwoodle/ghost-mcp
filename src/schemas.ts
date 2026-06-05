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

// Image upload returns { url, ref } — keyed on url, not id.
export const imageSchema = z
  .object({ url: z.string(), ref: z.string().nullable().optional() })
  .passthrough();

// Theme upload/activate returns a theme object keyed on name (no id).
export const themeSchema = z
  .object({ name: z.string(), active: z.boolean().optional() })
  .passthrough();

// Experimental-endpoint schemas (lenient, like the rest).
export const configSchema = z.object({ version: z.string().optional() }).passthrough();
export const settingSchema = z.object({ key: z.string() }).passthrough();
export const snippetSchema = entity.extend({ name: z.string().optional() });
export const redirectSchema = z
  .object({ from: z.string().optional(), to: z.string().optional() })
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
export type Image = z.infer<typeof imageSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Config = z.infer<typeof configSchema>;
export type Setting = z.infer<typeof settingSchema>;
export type Snippet = z.infer<typeof snippetSchema>;
export type Redirect = z.infer<typeof redirectSchema>;

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

// Field-tolerant validation for browse/read responses. Those tools accept a
// `fields` selector that can omit any field (including id), so the schema is
// relaxed to optional keys (`.partial()`): present fields are still type-checked
// and the value must be an object, but missing fields are tolerated. Returns the
// value unchanged.
export function validateSelectable(schema: z.ZodObject<any>, data: unknown): unknown {
  const result = schema.partial().safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new GhostError(`Unexpected Ghost response shape — ${detail}`);
  }
  return data;
}

// Field-tolerant validation of a browse result (an array of entities). Asserts
// the value is an array and validates each element; returns it unchanged.
export function validateSelectableList(schema: z.ZodObject<any>, data: unknown): unknown {
  if (!Array.isArray(data)) {
    throw new GhostError("Unexpected Ghost response shape — expected an array of entities.");
  }
  for (const item of data) validateSelectable(schema, item);
  return data;
}

// Validate the entity array inside a Ghost browse envelope ({ <key>: [...], meta })
// and return the envelope unchanged, preserving pagination meta. Field-tolerant on
// the items (browse may use a `fields` selector), but fails fast if the key is
// missing or not an array — that signals a response-shape mismatch.
export function validateEnvelope(schema: z.ZodObject<any>, data: unknown, key: string): unknown {
  const env = data as Record<string, unknown> | null;
  if (!env || typeof env !== "object" || !Array.isArray(env[key])) {
    throw new GhostError(`Unexpected Ghost response shape — expected "${key}" to be an array.`);
  }
  validateSelectableList(schema, env[key]);
  return data;
}

// Strict validation of a write-response envelope ({ <key>: [entity] }): the
// created/updated entity must be fully formed (id required). Used by add/edit,
// where no `fields` selector applies — so a missing id means a malformed response,
// not a trimmed one.
export function validateWriteEnvelope(schema: z.ZodObject<any>, data: unknown, key: string): unknown {
  const env = data as Record<string, unknown> | null;
  const arr = env && typeof env === "object" ? env[key] : undefined;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new GhostError(`Unexpected Ghost response shape — expected "${key}" to contain the written entity.`);
  }
  for (const item of arr) validateEntity(schema, item);
  return data;
}
