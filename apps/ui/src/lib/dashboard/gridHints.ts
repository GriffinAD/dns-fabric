import { perfGridHintOnlyExpandColSpan } from "../plugins/builtinMeta";
import { clampGridColSpan, clampGridRowSpan, tileColSpan } from "./gridPlacement";
import { findTileInLayout, mapTileInLayout } from "./layoutTree";
import type { DashboardLayout, DashboardLayoutV2, DashboardTile } from "./types";

export type ApplyLayoutStructureFn = (
  next: DashboardLayout,
  opts?: { preserveRootPlacementIfComplete?: boolean; editModeOverride?: boolean },
) => void;

/**
 * Applies perf-tile grid span hints from gauge layout. RAM uses “only expand” via
 * `perfGridHintOnlyExpandColSpan` (see `builtinMeta.ts`). Future: optional `gridPolicy` on registry entries.
 */
export function handlePerfTileGridHint(
  items: DashboardLayoutV2["items"],
  tileId: string,
  hint: { colSpan: number; rowSpan: number },
  applyLayoutStructure: ApplyLayoutStructureFn,
): void {
  const wantCs = clampGridColSpan(hint.colSpan);
  const wantRs = clampGridRowSpan(hint.rowSpan);
  const found = findTileInLayout(items, tileId);
  if (!found) return;
  const t = found.tile;
  const prevCs = t.grid?.colSpan ?? tileColSpan(t);
  const prevRs = t.grid?.rowSpan ?? 1;
  const nextCs =
    perfGridHintOnlyExpandColSpan(t.pluginId)
      ? clampGridColSpan(Math.max(prevCs, wantCs))
      : wantCs === 1
        ? 1
        : clampGridColSpan(Math.max(prevCs, wantCs));
  const nextRs = clampGridRowSpan(Math.max(prevRs, wantRs));
  if (prevCs === nextCs && prevRs === nextRs) return;
  const g = t.grid;
  applyLayoutStructure({
    version: 2,
    items: mapTileInLayout(items, tileId, (x: DashboardTile) => ({
      ...x,
      grid: {
        col: g?.col ?? 0,
        row: g?.row ?? 0,
        colSpan: nextCs,
        rowSpan: nextRs,
      },
    })),
  });
}
