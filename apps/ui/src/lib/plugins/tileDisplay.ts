import type { DashboardTile } from "../dashboard/types";

/** Perf tiles in compact mode use percent-only display for a smaller footprint (UI_ENGINE_PLAN P4.5). */
export function applyPerfCompactAsPercentOnly(tile: DashboardTile): DashboardTile {
  if (!tile.pluginId.startsWith("perf.")) return tile;
  if (tile.displayMode !== "compact") return tile;
  return {
    ...tile,
    options: { ...tile.options, display_style: "percent_only" },
  };
}
