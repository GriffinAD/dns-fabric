import { z } from "zod";

/** Tier-1 env maps may use string values from the API; coerce for display and PATCH. */
const envStringRecordSchema = z.record(z.string(), z.coerce.string());

export const envSchemaEntrySchema = z.object({
  key: z.string(),
  tier: z.number(),
  type: z.enum(["boolean", "integer", "string", "url"]),
  label: z.string(),
  requires_apply: z.boolean(),
  readonly: z.boolean().optional(),
  sensitive: z.boolean().optional(),
});

export const envSchemaResponseSchema = z.object({
  keys: z.array(envSchemaEntrySchema),
});

export const envConfigResponseSchema = z.object({
  effective: envStringRecordSchema,
  pending: envStringRecordSchema.nullable().optional(),
});

export const envPatchResponseSchema = z.object({
  staged: envStringRecordSchema,
  pending: envStringRecordSchema.nullable().optional(),
});

export const hostActionResponseSchema = z.object({
  kind: z.literal("host_action_required"),
  policy_ref: z.string(),
  mutation: z.string(),
  summary: z.string(),
  staged: z.record(z.string(), z.string()).optional(),
  next_steps: z.object({
    scripts: z.array(z.string()),
    example: z.string().optional(),
  }),
});

export const envApplyAppliedSchema = z.object({
  kind: z.literal("applied"),
  policy_ref: z.string(),
  mutation: z.string(),
  summary: z.string(),
  backup_path: z.string().optional(),
});

export const envApplyResponseSchema = z.union([hostActionResponseSchema, envApplyAppliedSchema]);

export type EnvSchemaEntry = z.infer<typeof envSchemaEntrySchema>;
export type EnvConfigResponse = z.infer<typeof envConfigResponseSchema>;
