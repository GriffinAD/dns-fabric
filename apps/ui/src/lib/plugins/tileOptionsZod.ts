/**
 * Per-plugin Zod schemas for `DashboardTile.options` (layout JSON).
 * Lives under `lib/plugins/` so `registry` / `PluginTileMount` can validate without importing `dashboard/` (beyond types).
 */
import { z } from "zod";

const perfTileOptionsSchema = z
  .object({
    cpu_total: z.boolean().optional(),
    network_by_adapter: z.boolean().optional(),
    disk_by_volume: z.boolean().optional(),
    display_style: z.enum(["gauge", "percent_only"]).optional(),
    gauge_gradient_mode: z.enum(["smooth", "banded"]).optional(),
    perf_max_cols: z.number().int().min(1).max(12).optional(),
  })
  .strict();

const baseDataTableSettingsPatchSchema = z
  .object({
    allowSort: z.boolean().optional(),
    allowFilter: z.boolean().optional(),
    fixedHeader: z.boolean().optional(),
    allowPaging: z.boolean().optional(),
    autoPageSize: z.boolean().optional(),
    pageSize: z.number().int().min(1).max(500).optional(),
    rowHeightMode: z.enum(["large", "normal", "compact"]).optional(),
    allowExportCsv: z.boolean().optional(),
    allowExportJson: z.boolean().optional(),
    allowModal: z.boolean().optional(),
    allowRefresh: z.boolean().optional(),
    allowEdit: z.boolean().optional(),
    exportScope: z.enum(["visible", "all"]).optional(),
    defaultSortColumnId: z.string().min(1).optional(),
    defaultSortDirection: z.enum(["asc", "desc"]).optional(),
    interactionMode: z.enum(["modal", "inline", "inline-expanded"]).optional(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    interactionMode:
      value.interactionMode === "inline-expanded" ? "inline" : value.interactionMode,
  }));

const nonPerfTileOptionsSchema = z
  .object({
    table: baseDataTableSettingsPatchSchema.optional(),
  })
  .strict();

const PERF_PREFIX = "perf.";

export function tileOptionsSchemaForPlugin(pluginId: string): z.ZodType<unknown> {
  if (pluginId.startsWith(PERF_PREFIX)) {
    return perfTileOptionsSchema;
  }
  return nonPerfTileOptionsSchema;
}
