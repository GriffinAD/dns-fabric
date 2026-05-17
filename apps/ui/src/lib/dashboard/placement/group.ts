import {
  findGroupByIdInItems,
  mapLayoutReplaceGroupById,
  mapTileInLayout,
} from "../layout/layoutTree";
import {
  clampGridColSpan,
  GRID_COLUMNS,
  GROUP_CHILD_INNER_STRIP_MAX_EXTENT,
  stripInnerPhysicalTrackCount,
} from "./constants";
import type { DashboardGroup, DashboardTile, GridPlacement, GroupChild, RootLayoutItem } from "../types";
import { isDashboardGroupNode } from "../types";
import {
  clampGridRowSpan,
  effectiveColSpan,
  effectiveRowSpan,
  gridAreaStyle,
  gridColumnSpanStyle,
  hasCompleteGrid,
  isCompleteGroupChildGrid,
  isCompleteGridPlacement,
  placementsOverlap,
  clampGroupChildGridPlacement,
} from "./tile";

export function maxRowEndFromPlacedGroupChildren(
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

export function groupOuterRowSpan(g: DashboardGroup, innerH: number): number {
  const cg = g.grid;
  if (cg != null && Number.isInteger(cg.rowSpan) && cg.rowSpan >= 1) {
    return clampGridRowSpan(cg.rowSpan);
  }
  return Math.max(1, innerH);
}
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

export function packOneGroupInLayout(it: DashboardGroup, options?: { editMode?: boolean }): DashboardGroup {
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

export function packGroupChildrenInLayout(
  items: RootLayoutItem[],
  options?: { editMode?: boolean },
): RootLayoutItem[] {
  return items.map((it) => (it.kind === "group" ? packOneGroupInLayout(it, options) : it));
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
