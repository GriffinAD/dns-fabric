import type { DashboardTile, GridPlacement } from "./types";

import { clampTileGridPlacement } from "./gridPlacement";

export type ReadOnlyRowUnit =
  | { kind: "panel"; id: string; tiles: DashboardTile[] }
  | { kind: "tile"; tile: DashboardTile };

/**
 * 1-based CSS `grid-row` start line and span for a row panel that encloses
 * the union of the member tiles' grid rectangles.
 */
export function rowPanelGridRowRange1Based(tiles: DashboardTile[]): { start1: number; span: number } {
  if (tiles.length === 0) return { start1: 1, span: 1 };
  const gs = tiles.map((t) => t.grid).filter((g): g is GridPlacement => g != null);
  if (gs.length === 0) return { start1: 1, span: 1 };
  let minR = Number.POSITIVE_INFINITY;
  let maxEnd = 0;
  for (const g of gs) {
    const end = g.row + g.rowSpan;
    minR = Math.min(minR, g.row);
    maxEnd = Math.max(maxEnd, end);
  }
  return { start1: minR + 1, span: Math.max(1, maxEnd - minR) };
}

/**
 * `grid-column` 1-based start and span. When every grid row the group uses contains **only**
 * tiles in this group (no other tile overlaps that row), the panel spans the full 12 columns
 * so the border is edge-to-edge even if the tiles do not use all columns. If any other tile
 * shares a row with the group, the border hugs the union of the member cells only.
 */
export function rowPanelGridColumnRange1Based(
  groupTiles: DashboardTile[],
  allTiles: DashboardTile[],
): { colStart1: number; colSpan: number; fullWidth: boolean } {
  const gs = groupTiles.map((t) => t.grid).filter((g): g is GridPlacement => g != null);
  if (gs.length === 0) {
    return { colStart1: 1, colSpan: 12, fullWidth: true };
  }
  const groupIds = new Set(groupTiles.map((t) => t.id));
  let minC = 12;
  let maxEnd = 0;
  for (const g of gs) {
    minC = Math.min(minC, g.col);
    maxEnd = Math.max(maxEnd, g.col + g.colSpan);
  }
  if (minC > 11) minC = 0;
  if (maxEnd < 1) maxEnd = 12;

  const rowsWithGroup = new Set<number>();
  for (const g of gs) {
    for (let r = g.row; r < g.row + g.rowSpan; r++) {
      rowsWithGroup.add(r);
    }
  }

  for (const r of rowsWithGroup) {
    for (const t of allTiles) {
      if (groupIds.has(t.id)) continue;
      const g = t.grid;
      if (!g) continue;
      if (g.row + g.rowSpan <= r || g.row > r) continue;
      return { colStart1: minC + 1, colSpan: maxEnd - minC, fullWidth: false };
    }
  }

  return { colStart1: 1, colSpan: 12, fullWidth: true };
}

function unitSortKey(u: ReadOnlyRowUnit): { row: number; col: number } {
  if (u.kind === "tile") {
    const g = u.tile.grid;
    return { row: g?.row ?? 0, col: g?.col ?? 0 };
  }
  const cols = u.tiles.map((t) => t.grid?.col ?? 0);
  const rows = u.tiles.map((t) => t.grid?.row ?? 0);
  return { row: Math.min(...rows), col: Math.min(...cols) };
}

/**
 * Build render units for the read-only dashboard. Tiles with the same non-empty
 * `rowPanel` id are one bordered panel; others render as before.
 * Units are ordered by top-left of their bounding box (row, col).
 */
export function buildReadOnlyRowPanelUnits(tiles: DashboardTile[]): ReadOnlyRowUnit[] {
  const withGrid = tiles.map((t) => ({
    ...t,
    grid: t.grid != null ? clampTileGridPlacement(t) : t.grid,
  }));
  const byId = new Map<string, DashboardTile[]>();
  for (const t of withGrid) {
    const k = t.rowPanel?.trim();
    if (!k) continue;
    if (!byId.has(k)) byId.set(k, []);
    byId.get(k)!.push(t);
  }
  for (const a of byId.values()) {
    a.sort(
      (x, y) => (x.grid?.row ?? 0) - (y.grid?.row ?? 0) || (x.grid?.col ?? 0) - (y.grid?.col ?? 0),
    );
  }
  const seenPanel = new Set<string>();
  const units: ReadOnlyRowUnit[] = [];
  for (const t of withGrid) {
    const k = t.rowPanel?.trim();
    if (k) {
      if (seenPanel.has(k)) continue;
      seenPanel.add(k);
      units.push({ kind: "panel", id: k, tiles: byId.get(k) ?? [t] });
    } else {
      units.push({ kind: "tile", tile: t });
    }
  }
  units.sort((a, b) => {
    const ra = unitSortKey(a);
    const rb = unitSortKey(b);
    return ra.row - rb.row || ra.col - rb.col;
  });
  return units;
}
