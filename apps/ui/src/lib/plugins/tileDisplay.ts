import type { DashboardTile } from "../dashboard/types";

/**
 * Perf tiles in compact mode use percent-only display for a smaller footprint (`docs/planning/UI_ENGINE_PLAN.md` P4.5).
 * Multi-series tiles (`network_by_adapter`, `disk_by_volume`) keep `display_style` so gauges (or
 * future list breakdown) are not collapsed to a single summary line.
 */
export function applyPerfCompactAsPercentOnly(tile: DashboardTile): DashboardTile {
  if (!tile.pluginId.startsWith("perf.")) return tile;
  if (tile.displayMode !== "compact") return tile;
  const opts = tile.options ?? {};
  if (opts.network_by_adapter === true || opts.disk_by_volume === true) return tile;
  return {
    ...tile,
    options: { ...opts, display_style: "percent_only" },
  };
}
