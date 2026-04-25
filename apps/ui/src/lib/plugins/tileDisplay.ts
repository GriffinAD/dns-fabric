import type { DashboardTile } from "../dashboard/types";

/**
 * Perf tiles in compact mode use percent-only display for a smaller footprint (`docs/planning/UI_ENGINE_PLAN.md` P4.5).
 * Dedicated `perf.network`, `perf.disk`, and `perf.summary` tiles keep the saved `display_style`
 * so “show as total” (single gauge) is not flipped to a percent list when multi-series flags go
 * false. CPU/RAM single-metric tiles still default to the compact percent list unless overridden.
 */
export function applyPerfCompactAsPercentOnly(tile: DashboardTile): DashboardTile {
  if (!tile.pluginId.startsWith("perf.")) return tile;
  if (tile.displayMode !== "compact") return tile;
  if (tile.pluginId === "perf.network" || tile.pluginId === "perf.disk" || tile.pluginId === "perf.summary") {
    return tile;
  }
  const opts = tile.options ?? {};
  return {
    ...tile,
    options: { ...opts, display_style: "percent_only" },
  };
}
