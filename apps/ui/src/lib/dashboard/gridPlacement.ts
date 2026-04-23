import { ensureLayoutV2 } from "./layoutTree";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV2,
  DashboardTile,
  GridPlacement,
  RootLayoutItem,
  RootTileItem,
} from "./types";

/**
 * Deep clone layout graph JSON. Prefer this over `structuredClone` for dashboard data: Svelte
 * `$state` proxies and other non-cloneable snapshots throw `DataCloneError` with `structuredClone`.
 */
export function cloneLayoutJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Visible dashboard uses 12 columns; must match API / layout.schema.json. */
export const GRID_COLUMNS = 12;

/** Max vertical span of a single tile (dashboard rows are unbounded). */
export const GRID_ROW_SPAN_MAX = 12;

/**
 * For group children when **Auto wrap is off** (`innerWrap` not true), horizontal
 * `col`/`colSpan` use the same 1/12 “dashboard width” units, but a row can extend
 * **past 12** along X so many tiles can sit on one scroller row (no `col+colSpan ≤ 12`).
 */
export const GROUP_CHILD_INNER_STRIP_MAX_EXTENT = 10_000;

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
  if (!(col >= 0 && col <= 11 && colSpan >= 1 && colSpan <= 12 && col + colSpan <= 12)) return false;
  if (row < 0 || rowSpan < 1 || rowSpan > GRID_ROW_SPAN_MAX) return false;
  return true;
}

/**
 * `autoWrap === true` → same 0–11 / col+colSpan ≤ 12 as the root grid.
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
 * @param groupAutoWrap - `true` = group with Auto wrap. `false` = no wrap (wider than 12-col
 *   strip allowed). Omitted = legacy 12-only behavior (e.g. unit tests without a group).
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

function maxRowEndFromPlacedChildren(tiles: DashboardTile[]): number {
  if (tiles.length === 0) return 1;
  const geoms = tiles
    .map((t) => t.grid)
    .filter((g): g is GridPlacement => g != null);
  if (geoms.length === 0) return 1;
  return Math.max(1, ...geoms.map((g) => g.row + g.rowSpan));
}

/** Root-level width in dashboard columns; used to align sub-layouts to the same column rhythm as the group/tile. */
export function groupOuterColSpan(g: DashboardGroup): number {
  const cg = g.grid;
  if (cg != null && Number.isInteger(cg.colSpan) && cg.colSpan >= 1 && cg.colSpan <= GRID_COLUMNS) {
    return clampGridColSpan(cg.colSpan);
  }
  return 12;
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
  for (const t of g.children) {
    const gr = t.grid;
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

/**
 * For **root** perf tiles: number of `1fr` sub-columns so gauge edges line up with the main
 * 12-col grid (roughly = effective col span in root columns). **Tiles inside a container**
 * ignore this in the UI (`dashboardGaugeAlign={false}`) and only equal-split the card width.
 */
export function alignGaugeColumnCount(parentGroup: DashboardGroup | null, tile: DashboardTile): number {
  const T = effectiveColSpan(tile);
  const gRoot = parentGroup == null ? GRID_COLUMNS : groupOuterColSpan(parentGroup);
  const w = (gRoot * T) / 12;
  return Math.max(1, Math.min(GRID_COLUMNS, Math.round(w)));
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
        if (!hasCompleteGrid(p)) {
          return { ...r, kind: "tile" as const, grid: clampTileGridPlacement(r) };
        }
        return {
          ...r,
          kind: "tile" as const,
          grid: clampTileGridPlacement({
            ...r,
            grid: {
              ...p.grid!,
              colSpan: effectiveColSpan(r),
              rowSpan: effectiveRowSpan(r),
            },
          }),
        };
      }
      if (r.kind === "group" && p.kind === "group") {
        const innerH = maxRowEndFromPlacedChildren(r.children);
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
    const innerH = maxRowEndFromPlacedChildren(r.children);
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

  const geoms: GridPlacement[] = next.map((it) => {
    if (it.kind === "tile") return clampTileGridPlacement(it);
    return {
      col: clampGridOriginCol(it.grid!.col, groupOuterColSpan(it)),
      row: clampGridOriginRow(it.grid!.row),
      colSpan: groupOuterColSpan(it),
      rowSpan: groupOuterRowSpan(it, maxRowEndFromPlacedChildren(it.children)),
    };
  });
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
 * For inner lists **inside a group only**: if every child already has a full grid, clamp
 * in-bounds; do not run `defragmentGapsInSingleRowTiles` (that shifts col origins to remove
 * “holes” and would reslot children when the user only changes the **container** span). If
 * any child is incomplete, use full `normalizeDashboardTiles` (incl. defrag) as before; if
 * clamped placements overlap, fall back to full normalize.
 */
function normalizeGroupChildrenPreservingColOrigins(tiles: DashboardTile[]): DashboardTile[] {
  if (tiles.length === 0) return tiles;
  if (!tiles.every((t) => t.grid && isCompleteGroupChildGrid(t.grid, false))) {
    return normalizeDashboardTiles(tiles);
  }
  const next = tiles.map((t) => ({ ...t, grid: clampGroupChildGridPlacement(t, false) }));
  if (placementsOverlap(next.map((t) => t.grid!))) {
    return normalizeDashboardTiles(tiles);
  }
  return next;
}

/**
 * Pack the root 12-col grid. Group children: do **not** defrag inner rows on save (editing
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
export function commitGroupInnerRowWraps(items: RootLayoutItem[]): RootLayoutItem[] {
  return items.map((it) => {
    if (it.kind !== "group" || it.innerWrap !== true) return it;
    const G = groupOuterColSpan(it);
    return {
      ...it,
      showBorder: it.showBorder !== false,
      children: packGroupChildrenRowWrapInOrder([...it.children], G),
    };
  });
}

function packGroupChildrenInLayout(
  items: RootLayoutItem[],
  options?: { editMode?: boolean },
): RootLayoutItem[] {
  return items.map((it) => {
    if (it.kind === "group") {
      if (it.innerWrap === true) {
        if (options?.editMode) {
          return { ...it, showBorder: it.showBorder !== false, children: [...it.children] };
        }
        const G = groupOuterColSpan(it);
        const children = packGroupChildrenRowWrapInOrder([...it.children], G);
        return { ...it, showBorder: it.showBorder !== false, children };
      }
      const children = normalizeGroupChildrenPreservingColOrigins([...it.children]);
      return { ...it, showBorder: it.showBorder !== false, children };
    }
    return it;
  });
}

export function packRootLayoutItems(items: RootLayoutItem[]): RootLayoutItem[] {
  const withInner: RootLayoutItem[] = items.map((it) => {
    if (it.kind === "group") {
      const G = groupOuterColSpan(it);
      const children =
        it.innerWrap === true
          ? packGroupChildrenRowWrapInOrder([...it.children], G)
          : normalizeDashboardTiles([...it.children]);
      return { ...it, showBorder: it.showBorder !== false, children };
    }
    if (it.kind === "tile") return it;
    return { ...(it as DashboardTile), kind: "tile" } as RootTileItem;
  });

  const packables = withInner.map((it) => {
    if (it.kind === "group") {
      const innerH = maxRowEndFromPlacedChildren(it.children);
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
): DashboardLayoutV2 {
  const v2 = ensureLayoutV2(layout);
  const cloned = cloneLayoutJson(v2.items);
  if (options?.preserveRootPlacementIfComplete) {
    const withInner = packGroupChildrenInLayout(cloned, { editMode: options?.editMode });
    if (withInner.every(hasCompleteRootOuter)) {
      const geoms: GridPlacement[] = withInner.map((it) => {
        if (it.kind === "tile") return clampTileGridPlacement(it);
        return {
          col: clampGridOriginCol(it.grid!.col, groupOuterColSpan(it)),
          row: clampGridOriginRow(it.grid!.row),
          colSpan: groupOuterColSpan(it),
          rowSpan: groupOuterRowSpan(it, maxRowEndFromPlacedChildren(it.children)),
        };
      });
      if (!placementsOverlap(geoms)) {
        return {
          version: 2,
          items: withInner.map((it, i) => {
            const g = geoms[i]!;
            if (it.kind === "tile") return { ...it, kind: "tile" as const, grid: g };
            return { ...it, kind: "group" as const, grid: g };
          }),
        };
      }
    }
  }
  return { version: 2, items: packRootLayoutItems(cloned) };
}

/** Inline style for a 1-based CSS grid placement from 0-based contract coords. */
export function gridAreaStyle(g: GridPlacement): string {
  /* Intentionally no `min-width: 0` here: on a flex + grid child it shrinks the item below
   * the grid area. Tracks use `minmax(0,1fr)`; overflow lives on inner flex rows in DashboardHost. */
  return `grid-column: ${g.col + 1} / span ${g.colSpan}; grid-row: ${g.row + 1} / span ${g.rowSpan};`;
}

/**
 * Placement inside a **group** whose inner grid has `innerColumns` physical tracks (G = group
 * width in root columns). The JSON 12-based contract is **one column unit = one main-dashboard
 * column** (same as the root 12-col grid), not 1/12 of the group only. Each physical `1fr`
 * track is therefore 1/12 of the full dashboard width, so a span of T uses `min(T, G)` tracks
 * and keeps the same pixel width as a root-level tile of width T, instead of `T*G/12` tracks
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
 * How many of the G physical group tracks a tile uses for its 12 contract width. One track =
 * one main-dashboard column, so this is `min(T, G)` (width T/12 of the viewport, capped by the
 * container), not `round(T*G/12)`.
 */
export function groupInnerWidthInPhysicalTracks(colSpan12: number, innerColumns: number): number {
  const T = clampGridColSpan(colSpan12);
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
