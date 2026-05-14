import { z } from "zod";

const widgetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  section: z.string().min(1),
});

export const dashboardResponseSchema = z
  .object({
    node: z.string(),
    version: z.string(),
    widgets: z.array(widgetSchema),
    sections: z.record(z.string(), z.unknown()),
  })
  .strict();

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const logCatalogEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.string().min(1),
});

export const logsCatalogResponseSchema = z
  .object({
    logs: z.array(logCatalogEntrySchema),
  })
  .strict();

export type LogsCatalogResponse = z.infer<typeof logsCatalogResponseSchema>;

/** Raw `/v1/meta` body before UI defaults. */
export const metaResponseSchema = z
  .object({
    peer_ui_base_url: z.string().nullable().optional(),
    node: z.string().optional(),
  })
  .strict();

export type MetaResponse = z.infer<typeof metaResponseSchema>;
