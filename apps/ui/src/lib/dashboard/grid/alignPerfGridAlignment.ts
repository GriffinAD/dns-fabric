import { effectiveColSpan, GRID_COLUMNS, groupOuterColSpan } from "./gridPlacement";
import type { DashboardGroup, DashboardTile } from "../types";

/**
 * Effective width of a perf gauge tile in root columns (rounded). Used by tests;
 * intratile gauge splits use equal `1fr` per gauge in `PerfMetricTile`.
 */
export function alignPerfGridAlignment(parentGroup: DashboardGroup | null, tile: DashboardTile): number {
  const T = effectiveColSpan(tile);
  const gRoot = parentGroup == null ? GRID_COLUMNS : groupOuterColSpan(parentGroup);
  const w = (gRoot * T) / GRID_COLUMNS;
  return Math.max(1, Math.min(GRID_COLUMNS, Math.round(w)));
}
