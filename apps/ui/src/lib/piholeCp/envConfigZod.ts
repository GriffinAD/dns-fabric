import { z } from "zod";

export const envSchemaEntrySchema = z.object({
  key: z.string(),
  tier: z.number(),
  type: z.enum(["boolean", "integer", "string", "url"]),
  label: z.string(),
  requires_apply: z.boolean(),
});

export const envSchemaResponseSchema = z.object({
  keys: z.array(envSchemaEntrySchema),
});

export const envConfigResponseSchema = z.object({
  effective: z.record(z.string(), z.string()),
  pending: z.record(z.string(), z.string()).nullable(),
});

export const envPatchResponseSchema = z.object({
  staged: z.record(z.string(), z.string()),
  pending: z.record(z.string(), z.string()).nullable(),
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

export type EnvSchemaEntry = z.infer<typeof envSchemaEntrySchema>;
export type EnvConfigResponse = z.infer<typeof envConfigResponseSchema>;
