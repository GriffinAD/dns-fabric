import { ensureLayoutV3 } from "../layoutTree";
import { cloneLayoutJson } from "./clone";
import { GRID_COLUMNS, clampGridColSpan } from "./constants";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV3,
  DashboardTile,
  GridPlacement,
  RootLayoutItem,
  RootTileItem,
} from "../types";
import {
  clampGridOriginCol,
  clampGridOriginRow,
  clampTileGridPlacement,
  effectiveColSpan,
  effectiveRowSpan,
  hasCompleteGrid,
  isCompleteGridPlacement,
  placementsOverlap,
} from "./tile";
import {
  groupOuterColSpan,
  groupOuterRowSpan,
  maxRowEndFromPlacedGroupChildren,
  packGroupChildrenInLayout,
  packOneGroupInLayout,
} from "./group";

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
