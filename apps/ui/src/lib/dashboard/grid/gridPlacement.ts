import { clampGridColSpan, GRID_COLUMNS, tileColSpanForPlugin } from "../../plugins/core/builtinMeta";
import {
  ensureLayoutV3,
  findGroupByIdInItems,
  mapLayoutReplaceGroupById,
  mapTileInLayout,
} from "../layout/layoutTree";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV3,
  DashboardTile,
  GridPlacement,
  GroupChild,
  RootLayoutItem,
  RootTileItem,
} from "../types";
import { isDashboardGroupNode } from "../types";

/**
 * Deep clone layout graph JSON. Prefer this over `structuredClone` for dashboard data: Svelte
 * `$state` proxies and other non-cloneable snapshots throw `DataCloneError` with `structuredClone`.
 */
export function cloneLayoutJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export { clampGridColSpan, GRID_COLUMNS } from "../../plugins/core/builtinMeta";

/** Max vertical span of a single tile (dashboard rows are unbounded). */
export const GRID_ROW_SPAN_MAX = 12;

/**
 * For group children when **Auto wrap is off** (`innerWrap` not true), horizontal
 * `col`/`colSpan` use the same 1/N “dashboard width” units (N = `GRID_COLUMNS`), but a row can extend
 * **past N** along X so many tiles can sit on one scroller row (no `col+colSpan ≤ N`).
 */
export const GROUP_CHILD_INNER_STRIP_MAX_EXTENT = 10_000;

/** Physical track count G for nowrap strip math (bounded by {@link GRID_COLUMNS}, at least 1). */
export function stripInnerPhysicalTrackCount(innerOrParentG: number): number {
  return Math.max(1, Math.min(GRID_COLUMNS, Math.floor(Number(innerOrParentG)) || 1));
}

/** Default width in columns when the tile has no custom `grid.colSpan`. */
export function tileColSpan(tile: DashboardTile): number {
  return tileColSpanForPlugin(tile);
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

/** Horizontal origin for a strip-mode group child: `0 … GROUP_CHILD_INNER_STRIP_MAX_EXTENT − colSpan`. */
export function clampGroupChildStripOriginCol(col: number, colSpan: number): number {
  const c = Math.floor(Number(col));
  if (!Number.isFinite(c)) return 0;
  const cs = Math.min(GRID_COLUMNS, Math.max(1, colSpan));
  const cap = Math.max(0, GROUP_CHILD_INNER_STRIP_MAX_EXTENT - cs);
  return Math.max(0, Math.min(cap, c));
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

export function isCompleteGridPlacement(g: GridPlacement | null | undefined): boolean {
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
  if (
    !(col >= 0 &&
      col <= GRID_COLUMNS - 1 &&
      colSpan >= 1 &&
      colSpan <= GRID_COLUMNS &&
      col + colSpan <= GRID_COLUMNS)
  ) {
    return false;
  }
  if (row < 0 || rowSpan < 1 || rowSpan > GRID_ROW_SPAN_MAX) return false;
  return true;
}

/**
 * `autoWrap === true` → same 0…(GRID_COLUMNS−1) / col+colSpan ≤ GRID_COLUMNS as the root grid.
 * `autoWrap === false` → “horizontal strip” (many tiles on one scroller row); `col` may exceed 11.
 */
export function isCompleteGroupChildGrid(
  g: GridPlacement | null | undefined,
  autoWrap: boolean,
): boolean {
  if (g == null) return false;
  if (autoWrap) {
    return isCompleteGridPlacement(g);
  }
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
  if (
    col < 0 ||
    colSpan < 1 ||
    colSpan > GRID_COLUMNS ||
    col + colSpan > GROUP_CHILD_INNER_STRIP_MAX_EXTENT
  ) {
    return false;
  }
  if (row < 0 || rowSpan < 1 || rowSpan > GRID_ROW_SPAN_MAX) return false;
  return true;
}

/** True when `grid` has integer col/row/spans within schema bounds. */
export function hasCompleteGrid(t: DashboardTile): boolean {
  return isCompleteGridPlacement(t.grid);
}

export function clampTileGridPlacement(t: DashboardTile): GridPlacement {
  const colSpan = effectiveColSpan(t);
  const rowSpan = effectiveRowSpan(t);
  const g = t.grid;
  const col = clampGridOriginCol(g?.col ?? 0, colSpan);
  const row = clampGridOriginRow(g?.row ?? 0);
  return { col, row, colSpan, rowSpan };
}

/** Clamp a tile inside a group; `autoWrap` matches `innerWrap === true` on the group. */
export function clampGroupChildGridPlacement(t: DashboardTile, autoWrap: boolean): GridPlacement {
  if (autoWrap) {
    return clampTileGridPlacement(t);
  }
  const colSpan = effectiveColSpan(t);
  const rowSpan = effectiveRowSpan(t);
  const g = t.grid;
  const col = clampGroupChildStripOriginCol(g?.col ?? 0, colSpan);
  const row = clampGridOriginRow(g?.row ?? 0);
  return { col, row, colSpan, rowSpan };
}

function isCompleteForGroupChildReorder(
  t: DashboardTile,
  groupAutoWrap: boolean | undefined,
): boolean {
  if (groupAutoWrap === undefined) {
    return hasCompleteGrid(t);
  }
  if (t.grid == null) {
    return false;
  }
  return isCompleteGroupChildGrid(t.grid, groupAutoWrap);
}

function clampByGroupChildReorder(
  t: DashboardTile,
  groupAutoWrap: boolean | undefined,
): GridPlacement {
  if (groupAutoWrap === undefined) {
    return clampTileGridPlacement(t);
  }
  return clampGroupChildGridPlacement(t, groupAutoWrap);
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
/**
 * @param groupAutoWrap - `true` = group with Auto wrap. `false` = no wrap (wider than root-col
 *   strip allowed). Omitted = legacy root-width-only behavior (e.g. unit tests without a group).
 */
export function reorderTilesPreservingSlotOrigins(
  prevTiles: DashboardTile[],
  reorderedTiles: DashboardTile[],
  groupAutoWrap?: boolean,
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
      if (!isCompleteForGroupChildReorder(prev, groupAutoWrap)) {
        return { ...t, grid: clampByGroupChildReorder(t, groupAutoWrap) };
      }
      return {
        ...t,
        grid: clampByGroupChildReorder(
          {
            ...t,
            grid: {
              ...prev.grid!,
              colSpan: effectiveColSpan(t),
              rowSpan: effectiveRowSpan(t),
            },
          },
          groupAutoWrap,
        ),
      };
    });
  }

  if (!prevTiles.every((p) => isCompleteForGroupChildReorder(p, groupAutoWrap))) {
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
  const geoms = next.map((t) => clampByGroupChildReorder(t, groupAutoWrap));
  if (placementsOverlap(geoms)) {
    return packTilesToGrid(reorderedTiles);
  }
  return next.map((t, i) => ({ ...t, grid: geoms[i]! }));
}

function maxRowEndFromPlacedGroupChildren(
  children: GroupChild[],
  parentAutoWrap: boolean | undefined,
): number {
  if (children.length === 0) return 1;
  const wrap = parentAutoWrap === true;
  let m = 1;
  for (const c of children) {
    if (isDashboardGroupNode(c)) {
      const innerH = maxRowEndFromPlacedGroupChildren(c.children, c.innerWrap === true);
      const cg = c.grid;
      if (cg != null && isCompleteGroupChildGrid(cg, wrap)) {
        m = Math.max(m, cg.row + groupOuterRowSpan(c, innerH));
      } else {
        m = Math.max(m, innerH);
      }
    } else {
      const g = c.grid;
      if (g == null || !isCompleteGroupChildGrid(g, wrap)) continue;
      m = Math.max(m, g.row + g.rowSpan);
    }
  }
  return Math.max(1, m);
}

/** Root-level width in dashboard columns; used to align sub-layouts to the same column rhythm as the group/tile. */
export function groupOuterColSpan(g: DashboardGroup): number {
  const cg = g.grid;
  if (cg != null && Number.isInteger(cg.colSpan) && cg.colSpan >= 1 && cg.colSpan <= GRID_COLUMNS) {
    return clampGridColSpan(cg.colSpan);
  }
  return GRID_COLUMNS;
}

function stripChildPlacementOrNull(c: GroupChild): GridPlacement | null {
  if (isDashboardGroupNode(c)) {
    const gr = c.grid;
    return gr != null && isCompleteGroupChildGrid(gr, false) ? gr : null;
  }
  const gr = c.grid;
  return gr != null && isCompleteGroupChildGrid(gr, false) ? gr : null;
}

/**
 * Default `grid` for an empty nested container appended into a **nowrap** parent (`innerWrap` not
 * true). Width = ⌊{@link groupOuterColSpan}(parent) / 2⌋ (at least 1 dashboard column). Horizontally
 * after siblings’ right edge when that still fits the root 0…`GRID_COLUMNS` contract for nested
 * `group.grid` (see `layoutZod`); otherwise a new row at `col` 0.
 */
export function placementForNewEmptyNestedGroup(parent: DashboardGroup): GridPlacement {
  const parentG = groupOuterColSpan(parent);
  const colSpan = Math.max(1, Math.floor(parentG / 2));
  let nextCol = 0;
  for (const c of parent.children) {
    const gr = stripChildPlacementOrNull(c);
    if (gr) nextCol = Math.max(nextCol, gr.col + gr.colSpan);
  }
  const rowSpan = 1;
  if (nextCol + colSpan <= GRID_COLUMNS) {
    const col = Math.max(0, Math.min(GRID_COLUMNS - colSpan, nextCol));
    return { col, row: 0, colSpan, rowSpan };
  }
  let maxRowEnd = 0;
  for (const c of parent.children) {
    const gr = stripChildPlacementOrNull(c);
    if (gr) maxRowEnd = Math.max(maxRowEnd, gr.row + gr.rowSpan);
  }
  return { col: 0, row: maxRowEnd, colSpan, rowSpan };
}

/**
 * Number of 1fr columns for the **layout editor** group inner. Auto wrap: G tracks only. No wrap:
 * at least G and the rightmost stored child extent so a wide strip can be placed without clipping.
 */
export function groupEditInnerColumnCount(g: DashboardGroup): number {
  const G = groupOuterColSpan(g);
  if (g.innerWrap === true) {
    return G;
  }
  let maxEnd = 0;
  for (const c of g.children) {
    if (isDashboardGroupNode(c)) {
      const innerCols = groupEditInnerColumnCount(c);
      const gr = c.grid;
      if (gr == null) {
        maxEnd = Math.max(maxEnd, innerCols);
        continue;
      }
      const { col, colSpan } = gr;
      if (
        !Number.isInteger(col) ||
        !Number.isInteger(colSpan) ||
        col < 0 ||
        colSpan < 1 ||
        colSpan > GRID_COLUMNS ||
        col + colSpan > GROUP_CHILD_INNER_STRIP_MAX_EXTENT
      ) {
        continue;
      }
      maxEnd = Math.max(maxEnd, col + Math.max(colSpan, innerCols));
      continue;
    }
    const gr = c.grid;
    if (gr == null) continue;
    const { col, colSpan } = gr;
    if (
      !Number.isInteger(col) ||
      !Number.isInteger(colSpan) ||
      col < 0 ||
      colSpan < 1 ||
      colSpan > GRID_COLUMNS ||
      col + colSpan > GROUP_CHILD_INNER_STRIP_MAX_EXTENT
    ) {
      continue;
    }
    maxEnd = Math.max(maxEnd, col + colSpan);
  }
  return Math.min(
    GROUP_CHILD_INNER_STRIP_MAX_EXTENT,
    Math.max(G, maxEnd, 1),
  );
}

function groupOuterRowSpan(g: DashboardGroup, innerH: number): number {
  const cg = g.grid;
  if (cg != null && Number.isInteger(cg.rowSpan) && cg.rowSpan >= 1) {
    return clampGridRowSpan(cg.rowSpan);
  }
  return Math.max(1, innerH);
}

function hasCompleteRootOuter(it: RootLayoutItem): boolean {
  if (it.kind === "tile") return hasCompleteGrid(it);
  return isCompleteGridPlacement(it.grid);
}

/** Like {@link hasCompleteRootOuter} but allows single-row layouts wider than {@link GRID_COLUMNS}. */
function hasPreservableRootOuter(it: RootLayoutItem): boolean {
  const g = it.grid;
  if (g == null || g.rowSpan !== 1) return false;
  const colSpan = it.kind === "tile" ? effectiveColSpan(it) : groupOuterColSpan(it);
  if (g.col + colSpan <= GRID_COLUMNS) {
    return hasCompleteRootOuter(it);
  }
  return (
    Number.isInteger(g.col) &&
    Number.isInteger(g.row) &&
    g.col >= 0 &&
    g.row >= 0 &&
    colSpan >= 1 &&
    colSpan <= GRID_COLUMNS
  );
}

/** Extra virtual columns past the packed row while dragging (row-end drop + horizontal scroll). */
export const ROOT_EDIT_ROW_END_DRAG_PAD_COLS = 4;

/**
 * Column count for the edit root grid: at least {@link GRID_COLUMNS}, plus packed extent and
 * optional trailing pad while dragging so drops past the last tile stay on the same row.
 */
export function rootEditGridColumnCount(
  items: RootLayoutItem[],
  options?: { dragging?: boolean },
): number {
  const pad = options?.dragging ? ROOT_EDIT_ROW_END_DRAG_PAD_COLS : 0;
  return Math.max(GRID_COLUMNS, rootLayoutGridColumnCount(items) + pad);
}

/**
 * Edit-mode display: keep DnD list order but attach persisted grids from `prev` (no slot swap).
 */
export function mergeRootLayoutGridsForEdit(
  prev: RootLayoutItem[],
  ordered: RootLayoutItem[],
): RootLayoutItem[] {
  const byId = new Map(prev.map((p) => [p.id, p]));
  return ordered.map((r) => {
    const p = byId.get(r.id);
    if (!p) return r;
    if (r.kind === "tile" && p.kind === "tile") {
      return { ...r, grid: p.grid ?? r.grid };
    }
    if (r.kind === "group" && p.kind === "group") {
      return {
        ...r,
        showBorder: r.showBorder !== false,
        grid: p.grid ?? r.grid,
        children: r.children,
      };
    }
    return r;
  });
}

/**
 * After root-level drag-reorder: i-th item in the new list gets the i-th (col,row) slot from
 * the previous order sorted by (row,col). Same contract as `reorderTilesPreservingSlotOrigins`.
 */
export function reorderRootLayoutItemsPreservingSlotOrigins(
  prev: RootLayoutItem[],
  reordered: RootLayoutItem[],
): RootLayoutItem[] {
  if (reordered.length !== prev.length) {
    return packRootLayoutItems(reordered);
  }

  const sameSequence =
    reordered.length === prev.length && reordered.every((r, i) => r.id === prev[i]!.id);
  if (sameSequence) {
    return reordered.map((r, i) => {
      const p = prev[i]!;
      if (r.kind === "tile" && p.kind === "tile") {
        if (hasPreservableRootOuter(r)) {
          return { ...r, kind: "tile" as const, grid: clampRootOuterGridPlacement(r) };
        }
        if (!hasCompleteGrid(p)) {
          return { ...r, kind: "tile" as const, grid: clampTileGridPlacement(r) };
        }
        const colSpan = hasCompleteGrid(r) ? effectiveColSpan(r) : effectiveColSpan(p);
        const rowSpan = hasCompleteGrid(r) ? effectiveRowSpan(r) : effectiveRowSpan(p);
        return {
          ...r,
          kind: "tile" as const,
          grid: clampTileGridPlacement({
            ...r,
            grid: {
              ...p.grid!,
              colSpan,
              rowSpan,
            },
          }),
        };
      }
      if (r.kind === "group" && p.kind === "group") {
        const innerH = maxRowEndFromPlacedGroupChildren(r.children, r.innerWrap === true);
        if (hasPreservableRootOuter(r)) {
          return {
            ...r,
            kind: "group" as const,
            showBorder: r.showBorder !== false,
            grid: clampRootOuterGridPlacement(r),
          };
        }
        if (!isCompleteGridPlacement(p.grid)) {
          return { ...r, kind: "group" as const, showBorder: r.showBorder !== false };
        }
        const colSpan = groupOuterColSpan(r);
        const rowSpan = groupOuterRowSpan(r, innerH);
        const grid = isCompleteGridPlacement(r.grid)
          ? {
              col: clampGridOriginCol(r.grid!.col, colSpan),
              row: clampGridOriginRow(r.grid!.row),
              colSpan,
              rowSpan,
            }
          : {
              col: p.grid!.col,
              row: p.grid!.row,
              colSpan,
              rowSpan,
            };
        return {
          ...r,
          kind: "group" as const,
          showBorder: r.showBorder !== false,
          grid,
        };
      }
      return r;
    });
  }

  if (!prev.every(hasCompleteRootOuter)) {
    return packRootLayoutItems(reordered);
  }

  const anchors = [...prev].sort(
    (a, b) => a.grid!.row - b.grid!.row || a.grid!.col - b.grid!.col,
  );
  const sortedSlots = anchors.map((t) => ({ col: t.grid!.col, row: t.grid!.row }));
  const next = reordered.map((r, i) => {
    const slot = sortedSlots[i]!;
    if (r.kind === "tile") {
      return {
        ...r,
        kind: "tile" as const,
        grid: {
          col: slot.col,
          row: slot.row,
          colSpan: effectiveColSpan(r),
          rowSpan: effectiveRowSpan(r),
        },
      } satisfies RootTileItem;
    }
    const innerH = maxRowEndFromPlacedGroupChildren(r.children, r.innerWrap === true);
    return {
      ...r,
      kind: "group" as const,
      showBorder: r.showBorder !== false,
      grid: {
        col: slot.col,
        row: slot.row,
        colSpan: groupOuterColSpan(r),
        rowSpan: groupOuterRowSpan(r, innerH),
      },
    } satisfies DashboardGroup;
  });

  const geoms: GridPlacement[] = next.map((it) => clampRootOuterGridPlacement(it));
  if (placementsOverlap(geoms)) {
    return packRootLayoutItems(reordered);
  }
  return next.map((it, i) => {
    const g = geoms[i]!;
    if (it.kind === "tile") return { ...it, grid: g };
    return { ...it, grid: g };
  });
}

/**
 * **Auto wrap off (strip):** place every tile in **one horizontal scroller row** (`row` = 0) in
 * array order. `col` advances by each tile’s width in the parent’s physical tracks
 * (`groupInnerWidthInPhysicalTracks`), not by the root 20-col “next row at full width” rule —
 * that incorrectly gave palette drops a `row` of 1 to the right of an existing first-row tile.
 */
export function packGroupChildrenNoWrapStripInOrder(
  tiles: DashboardTile[],
  innerColumns: number,
): DashboardTile[] {
  if (tiles.length === 0) return tiles;
  const G = stripInnerPhysicalTrackCount(innerColumns);
  let c = 0;
  const row = 0;
  return tiles.map((t) => {
    const cs = effectiveColSpan(t);
    const rs = effectiveRowSpan(t);
    const w = groupInnerWidthInPhysicalTracks(cs, G);
    const out: DashboardTile = { ...t, grid: { col: c, row, colSpan: cs, rowSpan: rs } };
    c += w;
    return out;
  });
}

function noWrapGroupChildIsCompleteInStrip(c: GroupChild): boolean {
  if (isDashboardGroupNode(c)) {
    const g = c.grid;
    return g != null && isCompleteGroupChildGrid(g, false);
  }
  return c.grid != null && isCompleteGroupChildGrid(c.grid, false);
}

/**
 * Re-pack **this** list’s outer `grid.col` in strip order (row 0) when any child is missing
 * a valid strip placement (e.g. a palette-dropped plugin beside a nested container). Does not
 * recurse: nested `children` were already passed through `packOneGroupInLayout`.
 */
function packMixedNoWrapChildrenInStripArrayOrder(
  parentG: number,
  children: GroupChild[],
): GroupChild[] {
  const Gp = stripInnerPhysicalTrackCount(parentG);
  let c = 0;
  const row = 0;
  return children.map((child) => {
    if (isDashboardGroupNode(child)) {
      const g = child;
      const colSpan = groupOuterColSpan(g);
      const innerH = maxRowEndFromPlacedGroupChildren(g.children, g.innerWrap === true);
      const rowSpan = groupOuterRowSpan(g, innerH);
      const w = groupInnerWidthInPhysicalTracks(colSpan, Gp);
      const next: DashboardGroup = {
        ...g,
        grid: { col: c, row, colSpan, rowSpan },
      };
      c += w;
      return next;
    }
    const t = child as DashboardTile;
    const cs = effectiveColSpan(t);
    const rs = effectiveRowSpan(t);
    const w = groupInnerWidthInPhysicalTracks(cs, Gp);
    const out: DashboardTile = { ...t, grid: { col: c, row, colSpan: cs, rowSpan: rs } };
    c += w;
    return out;
  });
}

/**
 * For inner lists **inside a group only**: if every child already has a full grid, clamp
 * in-bounds; do not run `defragmentGapsInSingleRowTiles` (that shifts col origins to remove
 * “holes” and would reslot children when the user only changes the **container** span). If
 * any child is incomplete, re-pack the strip in array order; if clamped placements overlap, fall
 * back to strip re-pack.
 */
function normalizeGroupChildrenPreservingColOrigins(
  tiles: DashboardTile[],
  groupInnerWidth: number,
): DashboardTile[] {
  if (tiles.length === 0) return tiles;
  if (!tiles.every((t) => t.grid && isCompleteGroupChildGrid(t.grid, false))) {
    return packGroupChildrenNoWrapStripInOrder(tiles, groupInnerWidth);
  }
  const next = tiles.map((t) => ({ ...t, grid: clampGroupChildGridPlacement(t, false) }));
  if (placementsOverlap(next.map((t) => t.grid!))) {
    return packGroupChildrenNoWrapStripInOrder(tiles, groupInnerWidth);
  }
  return next;
}

/**
 * Pack the root N-col grid (`GRID_COLUMNS`). Group children: do **not** defrag inner rows on save (editing
 * the container’s outer col/row span must not reslot or narrow inner tiles in place),
 * and do not run a blind `packTilesToGrid` (that would reset inner spans).
 */
/**
 * In array order, place each tile in (row-major) G-wide tracks, wrapping to the next row
 * when the next tile no longer fits. Col starts at 0 after each wrap. Width in tracks = min(T, G)
 * in the same 1:1 “dashboard column” model as `groupGridAreaStyle` / `groupInnerWidthInPhysicalTracks`.
 */
export function packGroupChildrenRowWrapInOrder(tiles: DashboardTile[], innerColumns: number): DashboardTile[] {
  const G = Math.max(1, Math.min(GRID_COLUMNS, Math.floor(Number(innerColumns)) || 1));
  if (tiles.length === 0) return tiles;
  let c = 0;
  let r = 0;
  return tiles.map((t) => {
    const cs = effectiveColSpan(t);
    const rs = effectiveRowSpan(t);
    const w = groupInnerWidthInPhysicalTracks(cs, G);
    if (c + w > G) {
      r += 1;
      c = 0;
    }
    const out: DashboardTile = { ...t, grid: { col: c, row: r, colSpan: cs, rowSpan: rs } };
    c += w;
    return out;
  });
}

/**
 * Recompute `grid` for every `innerWrap` group from the current child order. Call when leaving
 * layout edit, or when saving group settings, so col/row match the wrap layout.
 */
function commitInnerWrapOnGroup(it: DashboardGroup): DashboardGroup {
  const childrenFirst = it.children.map((c) =>
    isDashboardGroupNode(c) ? commitInnerWrapOnGroup(c) : c,
  );
  if (it.innerWrap !== true) {
    return { ...it, showBorder: it.showBorder !== false, children: childrenFirst };
  }
  const G = groupOuterColSpan(it);
  const tiles = childrenFirst.filter((c): c is DashboardTile => !isDashboardGroupNode(c));
  return {
    ...it,
    showBorder: it.showBorder !== false,
    children: packGroupChildrenRowWrapInOrder(tiles, G),
  };
}

export function commitGroupInnerRowWraps(items: RootLayoutItem[]): RootLayoutItem[] {
  return items.map((it) => (it.kind === "group" ? commitInnerWrapOnGroup(it) : it));
}

/** Strip-mode group children: recurse into nested groups; then strip-pack any incomplete placements. */
function packGroupChildrenNoWrapMixed(
  parent: DashboardGroup,
  options?: { editMode?: boolean },
): GroupChild[] {
  const G = groupOuterColSpan(parent);
  const { children } = parent;
  const nested = children.some(isDashboardGroupNode);
  const withRecurse = children.map((c) =>
    isDashboardGroupNode(c) ? packOneGroupInLayout(c, options) : c,
  );
  if (nested) {
    if (withRecurse.every(noWrapGroupChildIsCompleteInStrip)) {
      return withRecurse;
    }
    return packMixedNoWrapChildrenInStripArrayOrder(G, withRecurse);
  }
  return normalizeGroupChildrenPreservingColOrigins(
    withRecurse as DashboardTile[],
    G,
  );
}

function packOneGroupInLayout(it: DashboardGroup, options?: { editMode?: boolean }): DashboardGroup {
  if (it.innerWrap === true) {
    if (options?.editMode) {
      return { ...it, showBorder: it.showBorder !== false, children: [...it.children] };
    }
    const G = groupOuterColSpan(it);
    const tiles = it.children.filter((c): c is DashboardTile => !isDashboardGroupNode(c));
    return { ...it, showBorder: it.showBorder !== false, children: packGroupChildrenRowWrapInOrder(tiles, G) };
  }
  const children = packGroupChildrenNoWrapMixed(it, options);
  return { ...it, showBorder: it.showBorder !== false, children };
}

function packGroupChildrenInLayout(
  items: RootLayoutItem[],
  options?: { editMode?: boolean },
): RootLayoutItem[] {
  return items.map((it) => (it.kind === "group" ? packOneGroupInLayout(it, options) : it));
}

export function packRootLayoutItems(items: RootLayoutItem[]): RootLayoutItem[] {
  const withInner: RootLayoutItem[] = items.map((it) => {
    if (it.kind === "group") {
      return packOneGroupInLayout(it);
    }
    if (it.kind === "tile") return it;
    return { ...(it as DashboardTile), kind: "tile" } as RootTileItem;
  });

  const packables = withInner.map((it) => {
    if (it.kind === "group") {
      const innerH = maxRowEndFromPlacedGroupChildren(it.children, it.innerWrap === true);
      const colSpan = groupOuterColSpan(it);
      const rowSpan = groupOuterRowSpan(it, innerH);
      return { colSpan, rowSpan, item: it, kind: "group" as const };
    }
    const t = it;
    return {
      colSpan: effectiveColSpan(t),
      rowSpan: effectiveRowSpan(t),
      item: t,
      kind: "tile" as const,
    };
  });

  const rowBottom = new Array<number>(GRID_COLUMNS).fill(0);
  let c = 0;
  const out: RootLayoutItem[] = [];
  for (const p of packables) {
    const colSpan = p.colSpan;
    const rowSpan = p.rowSpan;
    if (c + colSpan > GRID_COLUMNS) {
      c = 0;
    }
    let row = 0;
    for (let j = c; j < c + colSpan; j++) {
      row = Math.max(row, rowBottom[j]!);
    }
    if (p.kind === "group") {
      const g = p.item;
      out.push({ ...g, grid: { col: c, row, colSpan, rowSpan } });
    } else {
      const t = p.item;
      out.push({ ...t, kind: "tile" as const, grid: { col: c, row, colSpan, rowSpan } });
    }
    const rowEnd = row + rowSpan;
    for (let j = c; j < c + colSpan; j++) {
      rowBottom[j] = rowEnd;
    }
    c += colSpan;
    if (c >= GRID_COLUMNS) {
      c = 0;
    }
  }
  return out;
}

export function layoutWithGrid(
  layout: DashboardLayout,
  options?: { preserveRootPlacementIfComplete?: boolean; editMode?: boolean },
): DashboardLayoutV3 {
  const v3 = ensureLayoutV3(layout);
  const cloned = cloneLayoutJson(v3.items);
  if (options?.preserveRootPlacementIfComplete) {
    const withInner = packGroupChildrenInLayout(cloned, { editMode: options?.editMode });
    if (withInner.every(hasPreservableRootOuter)) {
      const geoms: GridPlacement[] = withInner.map((it) => clampRootOuterGridPlacement(it));
      if (!placementsOverlap(geoms)) {
        return {
          version: 3,
          items: withInner.map((it, i) => {
            const g = geoms[i]!;
            if (it.kind === "tile") return { ...it, kind: "tile" as const, grid: g };
            return { ...it, kind: "group" as const, grid: g };
          }),
        };
      }
    }
  }
  return { version: 3, items: packRootLayoutItems(cloned) };
}

function rootItemColSpan(it: RootLayoutItem): number {
  if (it.kind === "tile") return effectiveColSpan(it);
  return groupOuterColSpan(it);
}

/** Preserve-path clamp: single-row placements may extend past {@link GRID_COLUMNS} for horizontal scroll. */
function clampRootOuterGridPlacement(it: RootLayoutItem): GridPlacement {
  if (it.kind === "tile") {
    const colSpan = effectiveColSpan(it);
    const rowSpan = effectiveRowSpan(it);
    const g = it.grid!;
    const row = clampGridOriginRow(g.row);
    const col = Math.max(0, Math.floor(Number(g.col)) || 0);
    if (rowSpan === 1 && col + colSpan > GRID_COLUMNS) {
      return { col, row, colSpan, rowSpan: 1 };
    }
    return clampTileGridPlacement(it);
  }
  const colSpan = groupOuterColSpan(it);
  const innerH = maxRowEndFromPlacedGroupChildren(it.children, it.innerWrap === true);
  const rowSpan = groupOuterRowSpan(it, innerH);
  const g = it.grid!;
  const row = clampGridOriginRow(g.row);
  const col = Math.max(0, Math.floor(Number(g.col)) || 0);
  if (rowSpan === 1 && col + colSpan > GRID_COLUMNS) {
    return { col, row, colSpan, rowSpan };
  }
  return {
    col: clampGridOriginCol(col, colSpan),
    row,
    colSpan,
    rowSpan,
  };
}

/** Root resize reflow: allow `col + colSpan` past {@link GRID_COLUMNS} so the edit grid can scroll horizontally. */
function assignRootItemColReflow(
  it: RootLayoutItem,
  col: number,
  colSpan: number,
  row: number,
): RootLayoutItem {
  const cs = clampGridColSpan(colSpan);
  const c = Math.max(0, Math.floor(Number(col)) || 0);
  const prev = it.grid ?? { col: 0, row: 0, colSpan: cs, rowSpan: 1 };
  const grid: GridPlacement = { ...prev, col: c, colSpan: cs, row };
  if (it.kind === "tile") return { ...it, grid };
  return { ...it, grid };
}

/** Column count for the root edit grid (`repeat(N, 1fr)`); at least {@link GRID_COLUMNS}. */
export function rootLayoutGridColumnCount(items: RootLayoutItem[]): number {
  let extent = GRID_COLUMNS;
  for (const it of items) {
    const gr = it.grid;
    if (!gr || gr.rowSpan !== 1) continue;
    extent = Math.max(extent, gr.col + rootItemColSpan(it));
  }
  return extent;
}

function rootRowMateIndices(items: RootLayoutItem[], row: number): number[] {
  const indices: number[] = [];
  items.forEach((it, i) => {
    const gr = it.grid;
    if (gr && gr.row === row && gr.rowSpan === 1) indices.push(i);
  });
  return indices.sort((a, b) => items[a]!.grid!.col - items[b]!.grid!.col);
}

/**
 * After a colSpan change on one root row, pack row-mates left with no gaps. The row may extend past
 * {@link GRID_COLUMNS}; the edit grid widens and scrolls horizontally instead of pushing tiles to the next row.
 */
export function reflowRootLayoutRow(items: RootLayoutItem[], row: number): RootLayoutItem[] {
  const indices = rootRowMateIndices(items, row);
  if (indices.length === 0) return items;
  const next = [...items];
  let col = 0;
  for (const i of indices) {
    const span = rootItemColSpan(next[i]!);
    next[i] = assignRootItemColReflow(next[i]!, col, span, row);
    col += span;
  }
  return next;
}

/** Move one single-row-span root item onto `row` (col unchanged until reflow). */
export function relocateRootItemToRow(
  items: RootLayoutItem[],
  itemId: string,
  row: number,
): RootLayoutItem[] {
  return items.map((it) => {
    if (it.id !== itemId) return it;
    const gr = it.grid;
    if (!gr) return it;
    if (gr.rowSpan === 1) {
      return assignRootItemColReflow(it, gr.col, rootItemColSpan(it), row);
    }
    return { ...it, grid: { ...gr, row } };
  });
}

/** Swap persisted grid slots for two root items (containers or tiles, any row span). */
export function swapRootItemGridPlacements(
  items: RootLayoutItem[],
  idA: string,
  idB: string,
): RootLayoutItem[] {
  const a = items.find((it) => it.id === idA);
  const b = items.find((it) => it.id === idB);
  if (!a?.grid || !b?.grid) return items;
  const aGrid = a.grid;
  const bGrid = b.grid;
  return items.map((it) => {
    if (it.id === idA) return { ...it, grid: { ...bGrid } };
    if (it.id === idB) return { ...it, grid: { ...aGrid } };
    return it;
  });
}

/** Exchange grid slots of two single-row-span root tiles (center drop / swap). */
export function swapRootSingleRowTilePlacements(
  items: RootLayoutItem[],
  idA: string,
  idB: string,
): RootLayoutItem[] {
  const a = items.find((it) => it.id === idA);
  const b = items.find((it) => it.id === idB);
  if (!a?.grid || !b?.grid || a.grid.rowSpan !== 1 || b.grid.rowSpan !== 1) return items;
  const aCol = a.grid.col;
  const aRow = a.grid.row;
  const bCol = b.grid.col;
  const bRow = b.grid.row;
  return items.map((it) => {
    if (it.id === idA) return assignRootItemColReflow(it, bCol, rootItemColSpan(it), bRow);
    if (it.id === idB) return assignRootItemColReflow(it, aCol, rootItemColSpan(it), aRow);
    return it;
  });
}

/** Pack single-row-span root items on `row` left-to-right in **layout list** order (DnD insert order). */
export function reflowRootLayoutRowInListOrder(items: RootLayoutItem[], row: number): RootLayoutItem[] {
  const next = [...items];
  let col = 0;
  for (let i = 0; i < next.length; i++) {
    const it = next[i]!;
    const gr = it.grid;
    if (!gr || gr.row !== row || gr.rowSpan !== 1) continue;
    const span = rootItemColSpan(it);
    next[i] = assignRootItemColReflow(it, col, span, row);
    col += span;
  }
  return next;
}

/**
 * Grid cell for the in-list DnD shadow while dragging (explicit `grid-area`, not list order).
 */
export function gridPlacementForRootDndShadowSlot(
  prev: RootLayoutItem[],
  draggedId: string,
  insertAt: number | undefined,
  anchorId: string | null,
): GridPlacement | null {
  const dragged = prev.find((p) => p.id === draggedId);
  if (!dragged?.grid || dragged.grid.rowSpan !== 1) return null;

  const colSpan = rootItemColSpan(dragged);
  const rowSpan = 1;

  if (anchorId) {
    const anchor = prev.find((p) => p.id === anchorId);
    if (anchor?.grid && anchor.grid.rowSpan === 1) {
      return {
        col: anchor.grid.col + rootItemColSpan(anchor),
        row: anchor.grid.row,
        colSpan,
        rowSpan,
      };
    }
  }

  const without = prev.filter((p) => p.id !== draggedId);
  const at =
    insertAt === undefined ? without.length : Math.max(0, Math.min(insertAt, without.length));
  const before = without[at];
  if (before?.grid && before.grid.rowSpan === 1) {
    return {
      col: before.grid.col,
      row: before.grid.row,
      colSpan,
      rowSpan,
    };
  }
  if (without.length === 0) {
    return { col: 0, row: 0, colSpan, rowSpan };
  }
  let maxRowEnd = 0;
  for (const p of without) {
    const gr = p.grid;
    if (!gr) continue;
    maxRowEnd = Math.max(maxRowEnd, gr.row + (gr.rowSpan ?? 1));
  }
  return { col: 0, row: maxRowEnd, colSpan, rowSpan };
}

/**
 * Place the dragged root item on the anchor tile's row, immediately to its right, then reflow.
 * Used when the pointer is in empty grid to the right (not slot-preservation swap).
 */
export function applyRootLayoutPointerDropPlacement(
  prev: RootLayoutItem[],
  reordered: RootLayoutItem[],
  draggedId: string,
  anchorId: string,
): RootLayoutItem[] {
  const anchorPrev = prev.find((p) => p.id === anchorId);
  const draggedPrev = prev.find((p) => p.id === draggedId);
  if (!anchorPrev?.grid || anchorPrev.grid.rowSpan !== 1) {
    return reorderRootLayoutItemsPreservingSlotOrigins(prev, reordered);
  }
  if (!draggedPrev?.grid || draggedPrev.grid.rowSpan !== 1) {
    return reorderRootLayoutItemsPreservingSlotOrigins(prev, reordered);
  }

  const row = anchorPrev.grid.row;
  const col = anchorPrev.grid.col + rootItemColSpan(anchorPrev);
  const oldRow = draggedPrev.grid.row;

  let next: RootLayoutItem[] = reordered.map((r) => {
    const p = prev.find((x) => x.id === r.id);
    return (p ?? r) as RootLayoutItem;
  });
  const di = next.findIndex((r) => r.id === draggedId);
  if (di < 0) return reorderRootLayoutItemsPreservingSlotOrigins(prev, reordered);

  next[di] = assignRootItemColReflow(next[di]!, col, rootItemColSpan(next[di]!), row);
  next = reflowRootLayoutRow(next, row);
  if (oldRow !== row) next = reflowRootLayoutRow(next, oldRow);
  return next;
}

/** Resize a root tile or group width; siblings on the same row shift left (row may scroll past 20 cols). */
export function resizeRootLayoutItemColSpan(
  items: RootLayoutItem[],
  itemId: string,
  newColSpan: number,
): RootLayoutItem[] {
  const idx = items.findIndex((it) => it.id === itemId);
  if (idx < 0) return items;
  const target = items[idx]!;
  const gr = target.grid;
  if (!gr || gr.rowSpan !== 1) return items;

  let next = [...items];
  next[idx] = assignRootItemColReflow(next[idx]!, gr.col, newColSpan, gr.row);
  return reflowRootLayoutRow(next, gr.row);
}

function repackGroupChildrenAfterColSpanChange(g: DashboardGroup): DashboardGroup {
  return {
    ...g,
    children: packMixedNoWrapChildrenInStripArrayOrder(groupOuterColSpan(g), g.children),
  };
}

/** Resize a tile inside a group; children are re-packed in array order. */
export function resizeGroupChildTileColSpan(
  items: RootLayoutItem[],
  groupId: string,
  tileId: string,
  newColSpan: number,
): RootLayoutItem[] {
  const group = findGroupByIdInItems(items, groupId);
  if (!group) return items;

  const withSpan = mapTileInLayout(items, tileId, (t) => {
    const gr = t.grid;
    if (!gr) return t;
    return { ...t, grid: { ...gr, colSpan: clampGridColSpan(newColSpan) } };
  });
  const updatedGroup = findGroupByIdInItems(withSpan, groupId);
  if (!updatedGroup) return withSpan;
  return mapLayoutReplaceGroupById(
    withSpan,
    groupId,
    repackGroupChildrenAfterColSpanChange(updatedGroup),
  );
}

/** Inline style for a 1-based CSS grid placement from 0-based contract coords. */
export function gridAreaStyle(g: GridPlacement): string {
  /* Intentionally no `min-width: 0` here: on a flex + grid child it shrinks the item below
   * the grid area. Tracks use `minmax(0,1fr)`; overflow lives on inner flex rows in DashboardHost. */
  return `grid-column: ${g.col + 1} / span ${g.colSpan}; grid-row: ${g.row + 1} / span ${g.rowSpan};`;
}

/**
 * Placement inside a **group** whose inner grid has `innerColumns` physical tracks (G = group
 * width in root columns). The JSON grid contract is **one column unit = one main-dashboard
 * column** (same as the root `GRID_COLUMNS`-wide grid), not 1/G of the group only. Each physical `1fr`
 * track is therefore 1/`GRID_COLUMNS` of the full dashboard width, so a span of T uses `min(T, G)` tracks
 * and keeps the same pixel width as a root-level tile of width T, instead of `T*G/GRID_COLUMNS` tracks
 * (which made widgets look “shrunk” in narrow groups).
 */
export function groupGridAreaStyle(placement: GridPlacement, innerColumns: number): string {
  const m = Math.max(
    1,
    Math.min(GROUP_CHILD_INNER_STRIP_MAX_EXTENT, Math.floor(Number(innerColumns)) || 1),
  );
  if (m === GRID_COLUMNS) {
    return gridAreaStyle(placement);
  }
  const { col, colSpan, row, rowSpan } = placement;
  const c0 = col < m ? col : m - 1;
  const s = Math.max(1, Math.min(colSpan, m - c0));
  return `grid-column: ${c0 + 1} / span ${s}; grid-row: ${row + 1} / span ${rowSpan};`;
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

/**
 * How many of the G physical group tracks a tile uses for its root contract width. One track =
 * one main-dashboard column, so this is `min(T, G)` (width T/`GRID_COLUMNS` of the viewport, capped by the
 * container), not `round(T*G/GRID_COLUMNS)`.
 */
export function groupInnerWidthInPhysicalTracks(contractColSpan: number, innerColumns: number): number {
  const T = clampGridColSpan(contractColSpan);
  const m = Math.max(
    1,
    Math.min(GROUP_CHILD_INNER_STRIP_MAX_EXTENT, Math.floor(Number(innerColumns)) || 1),
  );
  return Math.max(1, Math.min(m, T));
}

/**
 * `gridColumnSpanStyle` for a group whose inner grid has G columns (see `groupGridAreaStyle`).
 */
export function groupGridColumnSpanStyle(tile: DashboardTile, innerColumns: number): string {
  const m = Math.max(
    1,
    Math.min(GROUP_CHILD_INNER_STRIP_MAX_EXTENT, Math.floor(Number(innerColumns)) || 1),
  );
  if (m === GRID_COLUMNS) {
    return gridColumnSpanStyle(tile);
  }
  const rs = effectiveRowSpan(tile);
  const spanG = groupInnerWidthInPhysicalTracks(effectiveColSpan(tile), m);
  return `grid-column: span ${spanG}; grid-row: span ${rs};`;
}
