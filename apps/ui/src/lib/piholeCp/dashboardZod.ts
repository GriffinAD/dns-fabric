import { z } from "zod";

const widgetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  section: z.string().min(1),
  /** Optional slice for `section` (e.g. multiple HA tiles share `sections.ha`). */
  view: z.string().min(1).optional(),
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
    /** When set, perf/DHCP/discovery tiles call this Kea Fabric API origin (see `DataGateway.setKeaFabricApiBaseUrl`). */
    kea_fabric_api_base_url: z.string().min(1).nullable().optional(),
    /** Mirrors stack `DHCP_MODE` (e.g. `kea`); UI hides Kea DHCP / Fabric-only operator tiles when not `kea`. */
    dhcp_mode: z.string().min(1).nullable().optional(),
  })
  .strict();

export type MetaResponse = z.infer<typeof metaResponseSchema>;
