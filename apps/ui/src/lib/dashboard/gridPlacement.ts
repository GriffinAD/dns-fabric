import type { DashboardLayout, DashboardTile, GridPlacement } from "./types";

/** Visible dashboard uses 12 columns; must match API / layout.schema.json. */
export const GRID_COLUMNS = 12;

/** Max vertical span of a single tile (dashboard rows are unbounded). */
export const GRID_ROW_SPAN_MAX = 12;

/** Default width in columns when the tile has no custom `grid.colSpan`. */
export function tileColSpan(tile: DashboardTile): number {
  if (tile.pluginId === "perf.summary") return 12;
  if (
    tile.pluginId === "perf.cpu" ||
    tile.pluginId === "perf.ram" ||
    tile.pluginId === "perf.network" ||
    tile.pluginId === "perf.disk"
  ) {
    return 1;
  }
  return 6;
}

export function clampGridColSpan(n: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 1;
  return Math.min(GRID_COLUMNS, Math.max(1, v));
}

export function clampGridRowSpan(n: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 1;
  return Math.min(GRID_ROW_SPAN_MAX, Math.max(1, v));
}

function clampGridOriginCol(col: number, colSpan: number): number {
  const c = Math.floor(Number(col));
  if (!Number.isFinite(c)) return 0;
  return Math.max(0, Math.min(GRID_COLUMNS - colSpan, c));
}

function clampGridOriginRow(row: number): number {
  const r = Math.floor(Number(row));
  if (!Number.isFinite(r)) return 0;
  return Math.max(0, r);
}

export function effectiveColSpan(t: DashboardTile): number {
  if (t.grid != null && typeof t.grid.colSpan === "number") {
    return clampGridColSpan(t.grid.colSpan);
  }
  return tileColSpan(t);
}

export function effectiveRowSpan(t: DashboardTile): number {
  if (t.grid != null && typeof t.grid.rowSpan === "number") {
    return clampGridRowSpan(t.grid.rowSpan);
  }
  return 1;
}

/** True when `grid` has integer col/row/spans within schema bounds. */
export function hasCompleteGrid(t: DashboardTile): boolean {
  const g = t.grid;
  if (g == null) return false;
  const { col, row, colSpan, rowSpan } = g;
  if (
    typeof col !== "number" ||
    typeof row !== "number" ||
    typeof colSpan !== "number" ||
    typeof rowSpan !== "number"
  ) {
    return false;
  }
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    !Number.isInteger(colSpan) ||
    !Number.isInteger(rowSpan)
  ) {
    return false;
  }
  if (!(col >= 0 && col <= 11 && colSpan >= 1 && colSpan <= 12 && col + colSpan <= 12)) return false;
  if (row < 0 || rowSpan < 1 || rowSpan > GRID_ROW_SPAN_MAX) return false;
  return true;
}

export function clampTileGridPlacement(t: DashboardTile): GridPlacement {
  const colSpan = effectiveColSpan(t);
  const rowSpan = effectiveRowSpan(t);
  const g = t.grid;
  const col = clampGridOriginCol(g?.col ?? 0, colSpan);
  const row = clampGridOriginRow(g?.row ?? 0);
  return { col, row, colSpan, rowSpan };
}

function gridRectsOverlap(a: GridPlacement, b: GridPlacement): boolean {
  if (a.col + a.colSpan <= b.col || b.col + b.colSpan <= a.col) return false;
  if (a.row + a.rowSpan <= b.row || b.row + b.rowSpan <= a.row) return false;
  return true;
}

export function placementsOverlap(placements: GridPlacement[]): boolean {
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      if (gridRectsOverlap(placements[i]!, placements[j]!)) return true;
    }
  }
  return false;
}

/**
 * Assigns non-overlapping grid cells in tile order. Honors optional
 * `tile.grid.colSpan` / `tile.grid.rowSpan` when set; recomputes `col`/`row`.
 *
 * Tracks per-column “next free row” so `rowSpan > 1` blocks later tiles from
 * overlapping (e.g. tall reservations + clients both full-width).
 */
export function packTilesToGrid(tiles: DashboardTile[]): DashboardTile[] {
  const rowBottom = new Array<number>(GRID_COLUMNS).fill(0);
  let col = 0;
  const out: DashboardTile[] = [];

  for (const t of tiles) {
    const colSpan = effectiveColSpan(t);
    const rowSpan = effectiveRowSpan(t);

    if (col + colSpan > GRID_COLUMNS) {
      col = 0;
    }

    let row = 0;
    for (let j = col; j < col + colSpan; j++) {
      row = Math.max(row, rowBottom[j]!);
    }

    const grid: GridPlacement = { col, row, colSpan, rowSpan };
    out.push({ ...t, grid });

    const rowEnd = row + rowSpan;
    for (let j = col; j < col + colSpan; j++) {
      rowBottom[j] = rowEnd;
    }

    col += colSpan;
    if (col >= GRID_COLUMNS) {
      col = 0;
    }
  }

  return out;
}

/**
 * Tiles that already have a full `grid` keep it (after clamping). Others are
 * packed into remaining space using the same flow rules as `packTilesToGrid`.
 */
export function packTilesWithFixedAndFloating(tiles: DashboardTile[]): DashboardTile[] {
  const rowBottom = new Array<number>(GRID_COLUMNS).fill(0);
  for (const t of tiles) {
    if (!hasCompleteGrid(t)) continue;
    const g = clampTileGridPlacement(t);
    const rowEnd = g.row + g.rowSpan;
    for (let j = g.col; j < g.col + g.colSpan; j++) {
      rowBottom[j] = Math.max(rowBottom[j]!, rowEnd);
    }
  }

  const out: DashboardTile[] = [];
  let col = 0;
  for (const t of tiles) {
    if (hasCompleteGrid(t)) {
      out.push({ ...t, grid: clampTileGridPlacement(t) });
      continue;
    }
    const colSpan = effectiveColSpan(t);
    const rowSpan = effectiveRowSpan(t);
    if (col + colSpan > GRID_COLUMNS) {
      col = 0;
    }
    let row = 0;
    for (let j = col; j < col + colSpan; j++) {
      row = Math.max(row, rowBottom[j]!);
    }
    const grid: GridPlacement = { col, row, colSpan, rowSpan };
    out.push({ ...t, grid });
    const rowEnd = row + rowSpan;
    for (let j = col; j < col + colSpan; j++) {
      rowBottom[j] = rowEnd;
    }
    col += colSpan;
    if (col >= GRID_COLUMNS) {
      col = 0;
    }
  }

  const geoms = out.map((t) => t.grid!);
  if (placementsOverlap(geoms)) {
    return packTilesToGrid(tiles);
  }
  return out;
}

/**
 * If any grid row (only `rowSpan === 1` tiles) has an empty column *between* two tiles, pack
 * those tiles to start at col 0 with no gap. This fixes legacy layouts with accidental holes
 * (e.g. col 4, 6, 8 with 1+1+2) that looked like a broken / extremely narrow first row.
 */
function defragmentGapsInSingleRowTiles(next: DashboardTile[]): DashboardTile[] {
  const out: DashboardTile[] = next.map((t) => ({ ...t, grid: { ...t.grid! } }));
  const byRow = new Map<number, number[]>();
  out.forEach((t, idx) => {
    const g = t.grid;
    if (!g || g.rowSpan !== 1) return;
    const r = g.row;
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r)!.push(idx);
  });
  for (const idxs of byRow.values()) {
    if (idxs.length < 2) continue;
    const sortedIdx = [...idxs].sort((a, b) => out[a]!.grid!.col - out[b]!.grid!.col);
    let gap = false;
    for (let i = 1; i < sortedIdx.length; i++) {
      const p = out[sortedIdx[i - 1]!]!.grid!;
      const c = out[sortedIdx[i]!]!.grid!;
      if (p.col + p.colSpan < c.col) {
        gap = true;
        break;
      }
    }
    if (!gap) continue;
    let col = 0;
    for (const idx of sortedIdx) {
      const t = out[idx]!;
      const g = t.grid!;
      out[idx] = {
        ...t,
        grid: { ...g, col, row: g.row, colSpan: g.colSpan, rowSpan: 1 },
      };
      col += g.colSpan;
    }
  }
  return out;
}

/**
 * Clamp explicit grids; if anything overlaps or is missing, fall back to a full pack.
 */
export function normalizeDashboardTiles(tiles: DashboardTile[]): DashboardTile[] {
  if (tiles.length === 0) return tiles;
  if (!tiles.every(hasCompleteGrid)) {
    return packTilesWithFixedAndFloating(tiles);
  }
  const next = tiles.map((t) => ({ ...t, grid: clampTileGridPlacement(t) }));
  const geoms = next.map((t) => t.grid!);
  if (placementsOverlap(geoms)) {
    return packTilesToGrid(tiles);
  }
  return defragmentGapsInSingleRowTiles(next);
}

/**
 * After drag-reorder: i-th tile in the new list gets the i-th (col,row) when
 * sorted by previous (row,col), preserving gaps / empty half-rows. Tile spans
 * stay on each tile; if that creates overlap, fall back to compact packing.
 */
export function reorderTilesPreservingSlotOrigins(
  prevTiles: DashboardTile[],
  reorderedTiles: DashboardTile[],
): DashboardTile[] {
  if (reorderedTiles.length !== prevTiles.length) {
    return packTilesToGrid(reorderedTiles);
  }

  const sameSequence =
    reorderedTiles.length === prevTiles.length &&
    reorderedTiles.every((t, i) => t.id === prevTiles[i]!.id);
  if (sameSequence) {
    return reorderedTiles.map((t, i) => {
      const prev = prevTiles[i]!;
      if (!hasCompleteGrid(prev)) {
        return { ...t, grid: clampTileGridPlacement(t) };
      }
      return {
        ...t,
        grid: clampTileGridPlacement({
          ...t,
          grid: {
            ...prev.grid!,
            colSpan: effectiveColSpan(t),
            rowSpan: effectiveRowSpan(t),
          },
        }),
      };
    });
  }

  if (!prevTiles.every(hasCompleteGrid)) {
    return packTilesToGrid(reorderedTiles);
  }
  const anchors = [...prevTiles].sort(
    (a, b) => a.grid!.row - b.grid!.row || a.grid!.col - b.grid!.col,
  );
  const sortedSlots = anchors.map((t) => ({ col: t.grid!.col, row: t.grid!.row }));
  const next = reorderedTiles.map((t, i) => {
    const slot = sortedSlots[i]!;
    return {
      ...t,
      grid: {
        col: slot.col,
        row: slot.row,
        colSpan: effectiveColSpan(t),
        rowSpan: effectiveRowSpan(t),
      },
    };
  });
  const geoms = next.map((t) => clampTileGridPlacement(t));
  if (placementsOverlap(geoms)) {
    return packTilesToGrid(reorderedTiles);
  }
  return next.map((t, i) => ({ ...t, grid: geoms[i]! }));
}

export function layoutWithGrid(layout: DashboardLayout): DashboardLayout {
  return { ...layout, tiles: normalizeDashboardTiles(layout.tiles) };
}

/** Inline style for a 1-based CSS grid placement from 0-based contract coords. */
export function gridAreaStyle(g: GridPlacement): string {
  /* Intentionally no `min-width: 0` here: on a flex + grid child it shrinks the item below
   * the grid area. Tracks use `minmax(0,1fr)`; overflow lives on inner flex rows in DashboardHost. */
  return `grid-column: ${g.col + 1} / span ${g.colSpan}; grid-row: ${g.row + 1} / span ${g.rowSpan};`;
}

/**
 * Host + editor: auto-place by DOM order with span only (works with svelte-dnd-action).
 * Uses packed `tile.grid` when present, else effective spans from the tile.
 * No `min-width: 0` on the inline style (same reason as `gridAreaStyle`).
 */
export function gridColumnSpanStyle(tile: DashboardTile): string {
  const cs = effectiveColSpan(tile);
  const rs = effectiveRowSpan(tile);
  return `grid-column: span ${cs}; grid-row: span ${rs};`;
}
