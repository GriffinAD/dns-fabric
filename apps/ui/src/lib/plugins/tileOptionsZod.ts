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
    perf_max_cols: z.number().int().min(1).max(12).optional(),
  })
  .strict();

const nonPerfTileOptionsSchema = z.object({}).strict();

const PERF_PREFIX = "perf.";

export function tileOptionsSchemaForPlugin(pluginId: string): z.ZodType<unknown> {
  if (pluginId.startsWith(PERF_PREFIX)) {
    return perfTileOptionsSchema;
  }
  return nonPerfTileOptionsSchema;
}
