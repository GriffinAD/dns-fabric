import type { DragDropState } from "@thisux/sveltednd";

import type { DashboardDndListItem } from "../groupDndFinalize";
import { buildRootLayoutFromDnd, isDndCellGroup } from "../groupDndFinalize";
import { dedupeById } from "../layoutTree";
import {
  applyRootLayoutPointerDropPlacement,
  packRootLayoutItems,
  reflowRootLayoutRowInListOrder,
  relocateRootItemToRow,
  reorderRootLayoutItemsPreservingSlotOrigins,
  swapRootItemGridPlacements,
  swapRootSingleRowTilePlacements,
} from "../gridPlacement";
import { findGroupByIdInItems } from "../layoutTree";
import type { DashboardLayout, RootLayoutItem } from "../types";

import {
  type DashboardDragPayload,
  parseDragPayload,
  parseDropContainer,
  type ParsedDropSlot,
  ROOT_APPEND_CONTAINER,
  ROOT_CANVAS_CONTAINER,
  ROOT_EMPTY_CONTAINER,
} from "./dashboardSveltedndTypes";

/** Drop band on a root tile hit target (pointer position within the tile). */
export type RootTileDropBand = "before" | "after" | "center";

export type DashboardDropContext = {
  dndRoot: DashboardDndListItem[];
  dndByGroup: Record<string, DashboardDndListItem[]>;
  layoutItems: RootLayoutItem[];
  /** Last pointer position during drag (for left/right/center on root tiles). */
  pointerClient?: { x: number; y: number };
  onLayoutStructureChange?: (next: DashboardLayout) => void;
  onAddTile?: (pluginId: string, insertBeforeIndex?: number) => void;
  onAddGroup?: (insertBeforeIndex?: number) => void;
  onAddTileToGroup?: (groupId: string, pluginId: string) => void;
  /** Palette drop onto a `hostControl: tab-control` strip (append tab via `addTabChild`). */
  onAddTabToGroup?: (groupId: string, pluginId: string) => void;
  onAddGroupToGroup?: (parentGroupId: string) => void;
};

const ROOT_TILE_CENTER_BAND_RATIO = 0.3;

/** Map pointer + sveltednd edge to left / right / center on a root tile. */
export function resolveRootTileDropBand(
  targetElement: HTMLElement | null,
  dropPosition: "before" | "after",
  pointerClient: { x: number; y: number } | undefined,
): RootTileDropBand {
  if (!targetElement || !pointerClient) return dropPosition;
  const rect = targetElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return dropPosition;
  const nx = (pointerClient.x - (rect.left + rect.width / 2)) / (rect.width / 2);
  const ny = (pointerClient.y - (rect.top + rect.height / 2)) / (rect.height / 2);
  if (Math.abs(nx) < ROOT_TILE_CENTER_BAND_RATIO && Math.abs(ny) < ROOT_TILE_CENTER_BAND_RATIO) {
    return "center";
  }
  if (Math.abs(nx) >= Math.abs(ny)) {
    return nx < 0 ? "before" : "after";
  }
  return dropPosition;
}

export type DashboardDropResult = {
  nextDndRoot?: DashboardDndListItem[];
  nextDndByGroup?: Record<string, DashboardDndListItem[]>;
};

export type ApplyDashboardDropOptions = {
  /** When false, only update DnD mirror lists (live drag preview); persist on drop. */
  persist?: boolean;
};

/** Reorder `items` moving `draggedId` before/after `targetId` (distinct ids). */
export function reorderByTarget<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string,
  dropPosition: "before" | "after",
): T[] {
  if (draggedId === targetId) return items;
  const list = [...items];
  const fromIdx = list.findIndex((x) => x.id === draggedId);
  const targetIdx = list.findIndex((x) => x.id === targetId);
  if (fromIdx < 0 || targetIdx < 0) return items;
  const [removed] = list.splice(fromIdx, 1);
  let insertAt = targetIdx + (dropPosition === "after" ? 1 : 0);
  if (fromIdx < targetIdx) insertAt--;
  list.splice(insertAt, 0, removed!);
  return list;
}

function findListItem(list: DashboardDndListItem[], id: string): DashboardDndListItem | undefined {
  return list.find((x) => x.id === id);
}

function removeById(list: DashboardDndListItem[], id: string): { next: DashboardDndListItem[]; removed?: DashboardDndListItem } {
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return { next: list };
  const removed = list[idx];
  return { next: [...list.slice(0, idx), ...list.slice(idx + 1)], removed };
}

/** Move a root list item to the end (blank canvas / append row). */
function moveDndItemToEnd(list: DashboardDndListItem[], draggedId: string): DashboardDndListItem[] {
  const { next, removed } = removeById(list, draggedId);
  if (!removed) return list;
  return dedupeById([...next, removed]);
}

function reorderRootDrag(
  dndRoot: DashboardDndListItem[],
  draggedId: string,
  slot: ParsedDropSlot,
  anchorId: string,
  dropPosition: "before" | "after",
): DashboardDndListItem[] {
  if (slot.kind === "rootEmpty" || slot.kind === "rootCanvas" || slot.kind === "rootAppend") {
    return moveDndItemToEnd(dndRoot, draggedId);
  }
  return reorderByTarget(dndRoot, draggedId, anchorId, dropPosition);
}

function swapDndListById<T extends { id: string }>(list: T[], idA: string, idB: string): T[] {
  const ia = list.findIndex((x) => x.id === idA);
  const ib = list.findIndex((x) => x.id === idB);
  if (ia < 0 || ib < 0 || ia === ib) return list;
  const out = [...list];
  const tmp = out[ia]!;
  out[ia] = out[ib]!;
  out[ib] = tmp;
  return out;
}

/** Place dragged root tile onto target row: shift (before/after) or swap (center). */
function persistLayout(ctx: DashboardDropContext, items: RootLayoutItem[], persist: boolean) {
  if (persist) ctx.onLayoutStructureChange?.({ version: 3, items });
}

function commitRootTileSlotDrop(
  ctx: DashboardDropContext,
  merged: RootLayoutItem[],
  draggedId: string,
  targetId: string,
  band: RootTileDropBand,
  draggedGrid: RootLayoutItem["grid"] | undefined,
  targetGrid: RootLayoutItem["grid"] | undefined,
  persist: boolean,
) {
  if (!targetGrid || !draggedGrid) {
    persistLayout(ctx, packRootLayoutItems(merged), persist);
    return;
  }

  if (!isSingleRowRootGrid(targetGrid) || !isSingleRowRootGrid(draggedGrid)) {
    let next =
      band === "center"
        ? swapRootItemGridPlacements(merged, draggedId, targetId)
        : relocateRootItemToRow(merged, draggedId, targetGrid.row);
    if (isSingleRowRootGrid(targetGrid)) {
      next = reflowRootLayoutRowInListOrder(next, targetGrid.row);
    }
    if (isSingleRowRootGrid(draggedGrid) && draggedGrid.row !== targetGrid.row) {
      next = reflowRootLayoutRowInListOrder(next, draggedGrid.row);
    }
    persistLayout(ctx, packRootLayoutItems(next), persist);
    return;
  }

  if (band === "center") {
    let next = swapRootSingleRowTilePlacements(merged, draggedId, targetId);
    next = reflowRootLayoutRowInListOrder(next, targetGrid.row);
    if (draggedGrid.row !== targetGrid.row) {
      next = reflowRootLayoutRowInListOrder(next, draggedGrid.row);
    }
    persistLayout(ctx, next, persist);
    return;
  }

  const targetRow = targetGrid.row;
  const oldRow = draggedGrid.row;
  let next = relocateRootItemToRow(merged, draggedId, targetRow);
  next = reflowRootLayoutRowInListOrder(next, targetRow);
  if (oldRow !== targetRow) next = reflowRootLayoutRowInListOrder(next, oldRow);
  persistLayout(ctx, next, persist);
}

/** Insert `item` before or after the row with `targetId` in `list` (no removal). */
function insertRelativeTo(
  list: DashboardDndListItem[],
  item: DashboardDndListItem,
  targetId: string,
  dropPosition: "before" | "after",
): DashboardDndListItem[] {
  const targetIdx = list.findIndex((x) => x.id === targetId);
  if (targetIdx < 0) return dedupeById([...list, item]);
  const insertAt = targetIdx + (dropPosition === "after" ? 1 : 0);
  const copy = [...list];
  copy.splice(insertAt, 0, item);
  return dedupeById(copy);
}

function commitLayout(
  ctx: DashboardDropContext,
  nextRoot: DashboardDndListItem[],
  nextBy: Record<string, DashboardDndListItem[]>,
  persist: boolean,
) {
  const merged = buildRootLayoutFromDnd(ctx.layoutItems, nextRoot, nextBy);
  const items = reorderRootLayoutItemsPreservingSlotOrigins(ctx.layoutItems, merged);
  persistLayout(ctx, items, persist);
}

function rootItemGrid(id: string, items: RootLayoutItem[]) {
  return items.find((p) => p.id === id)?.grid;
}

function isSingleRowRootGrid(g: RootLayoutItem["grid"] | undefined): g is NonNullable<RootLayoutItem["grid"]> {
  return g != null && g.rowSpan === 1;
}

/** Commit a root list reorder: shift within row(s) or pack when changing rows / blank canvas. */
function commitRootListReorder(
  ctx: DashboardDropContext,
  nextRoot: DashboardDndListItem[],
  nextBy: Record<string, DashboardDndListItem[]>,
  draggedId: string,
  targetId: string,
  dropPosition: "before" | "after",
  mode: "tileSlot" | "rowEnd" | "gapAfter" | "canvas",
  persist: boolean,
  tileBand?: RootTileDropBand,
) {
  let merged = buildRootLayoutFromDnd(ctx.layoutItems, nextRoot, nextBy);
  const draggedGrid = rootItemGrid(draggedId, ctx.layoutItems);
  const targetGrid = rootItemGrid(targetId, ctx.layoutItems);

  if (mode === "rowEnd" && isSingleRowRootGrid(targetGrid)) {
    merged = applyRootLayoutPointerDropPlacement(ctx.layoutItems, merged, draggedId, targetId);
    persistLayout(ctx, merged, persist);
    return;
  }

  if (mode === "canvas") {
    persistLayout(ctx, packRootLayoutItems(merged), persist);
    return;
  }

  if (mode === "gapAfter" && isSingleRowRootGrid(targetGrid)) {
    merged = reflowRootLayoutRowInListOrder(merged, targetGrid.row);
    if (isSingleRowRootGrid(draggedGrid) && draggedGrid.row !== targetGrid.row) {
      merged = reflowRootLayoutRowInListOrder(merged, draggedGrid.row);
    }
    persistLayout(ctx, merged, persist);
    return;
  }

  if (mode === "gapAfter") {
    persistLayout(ctx, packRootLayoutItems(merged), persist);
    return;
  }

  if (mode === "tileSlot" && tileBand) {
    commitRootTileSlotDrop(ctx, merged, draggedId, targetId, tileBand, draggedGrid, targetGrid, persist);
    return;
  }

  persistLayout(ctx, packRootLayoutItems(merged), persist);
}

function rootInsertIndex(dndRoot: DashboardDndListItem[], slot: ParsedDropSlot, dropPosition: "before" | "after"): number {
  if (slot.kind === "rootEmpty" || slot.kind === "rootCanvas" || slot.kind === "rootAppend") {
    return dndRoot.length;
  }
  if (slot.kind === "rootGapAfter") {
    const idx = dndRoot.findIndex((d) => d.id === slot.id);
    return idx < 0 ? dndRoot.length : idx + 1;
  }
  if (slot.kind !== "root" && slot.kind !== "rootRowEnd") return dndRoot.length;
  const idx = dndRoot.findIndex((d) => d.id === slot.id);
  if (idx < 0) return dndRoot.length;
  if (slot.kind === "rootRowEnd") return idx + 1;
  return dropPosition === "before" ? idx : idx + 1;
}

function isRootSurfaceSlot(slot: ParsedDropSlot): boolean {
  return (
    slot.kind === "root" ||
    slot.kind === "rootRowEnd" ||
    slot.kind === "rootGapAfter" ||
    slot.kind === "rootEmpty" ||
    slot.kind === "rootCanvas" ||
    slot.kind === "rootAppend"
  );
}

function isGroupSurfaceSlot(slot: ParsedDropSlot): boolean {
  return (
    slot.kind === "groupChild" ||
    slot.kind === "groupEmpty" ||
    slot.kind === "groupCanvas" ||
    slot.kind === "groupGapAfter" ||
    slot.kind === "groupAppend"
  );
}

function isGroupEndSlot(slot: ParsedDropSlot): boolean {
  return slot.kind === "groupEmpty" || slot.kind === "groupCanvas" || slot.kind === "groupAppend";
}

function isTabGroupSurfaceSlot(slot: ParsedDropSlot): boolean {
  return isGroupSurfaceSlot(slot) || slot.kind === "groupTabs";
}

function isTabControlGroupInLayout(items: RootLayoutItem[], groupId: string): boolean {
  return findGroupByIdInItems(items, groupId)?.hostControl === "tab-control";
}

/** Reorder within one group list using canvas-style bands on a child tile. */
function reorderGroupChildDrag(
  list: DashboardDndListItem[],
  draggedId: string,
  targetChildId: string,
  dropPosition: "before" | "after",
  targetElement: HTMLElement | null,
  pointerClient: { x: number; y: number } | undefined,
): DashboardDndListItem[] {
  const band = resolveRootTileDropBand(targetElement, dropPosition, pointerClient);
  if (band === "center" && draggedId !== targetChildId) {
    return swapDndListById(list, draggedId, targetChildId);
  }
  const listPos: "before" | "after" = band !== "center" ? band : dropPosition;
  return reorderByTarget(list, draggedId, targetChildId, listPos);
}

/**
 * Apply a successful drop from @thisux/sveltednd. Caller should ensure `!state.invalidDrop`
 * and that `state.dropPosition` is set when required.
 */
export function applyDashboardDrop(
  state: DragDropState<DashboardDragPayload>,
  ctx: DashboardDropContext,
  options: ApplyDashboardDropOptions = {},
): DashboardDropResult {
  const persist = options.persist !== false;
  const drag = parseDragPayload(state.draggedItem) ?? (state.draggedItem as DashboardDragPayload);
  const slot = parseDropContainer(state.targetContainer);
  const pos = state.dropPosition ?? "before";
  const rootPos: "before" | "after" =
    slot?.kind === "rootRowEnd" || slot?.kind === "rootGapAfter" ? "after" : pos;

  if (!slot) return {};

  // Palette → root (root-group shells commit into that group)
  if (drag.k === "pp" && isRootSurfaceSlot(slot)) {
    if (slot.kind === "root") {
      const targetRoot = findListItem(ctx.dndRoot, slot.id);
      if (targetRoot && isDndCellGroup(targetRoot.item)) {
        ctx.onAddTileToGroup?.(targetRoot.item.id, drag.i);
        return {};
      }
    }
    ctx.onAddTile?.(drag.i, rootInsertIndex(ctx.dndRoot, slot, rootPos));
    return {};
  }
  if (drag.k === "pg" && isRootSurfaceSlot(slot)) {
    if (slot.kind === "root") {
      const targetRoot = findListItem(ctx.dndRoot, slot.id);
      if (targetRoot && isDndCellGroup(targetRoot.item)) {
        ctx.onAddGroupToGroup?.(targetRoot.item.id);
        return {};
      }
    }
    ctx.onAddGroup?.(rootInsertIndex(ctx.dndRoot, slot, rootPos));
    return {};
  }

  // Palette → group (tab-control strip uses addTabChild, not nowrap child append)
  if (drag.k === "pp" && isTabGroupSurfaceSlot(slot)) {
    if (isTabControlGroupInLayout(ctx.layoutItems, slot.groupId)) {
      ctx.onAddTabToGroup?.(slot.groupId, drag.i);
    } else if (isGroupSurfaceSlot(slot)) {
      ctx.onAddTileToGroup?.(slot.groupId, drag.i);
    }
    return {};
  }
  if (drag.k === "pg" && isGroupSurfaceSlot(slot)) {
    ctx.onAddGroupToGroup?.(slot.groupId);
    return {};
  }

  // Root cell
  if (drag.k === "cr") {
    const draggedRoot = findListItem(ctx.dndRoot, drag.i);
    const draggingRootGroup = draggedRoot ? isDndCellGroup(draggedRoot.item) : false;
    // No-op when a root row resolves to its own root slot on drop.
    if (
      (slot.kind === "root" || slot.kind === "rootRowEnd" || slot.kind === "rootGapAfter") &&
      slot.id === drag.i
    ) {
      return {};
    }
    // Defensive: if a root group resolves to one of its own inner slots at drop time,
    // keep this as a no-op instead of moving/removing the container.
    if (draggingRootGroup && isGroupSurfaceSlot(slot) && slot.groupId === drag.i) {
      return {};
    }
    if (isRootSurfaceSlot(slot)) {
      if ((slot.kind === "rootEmpty" || slot.kind === "rootCanvas") && ctx.dndRoot.length === 0) {
        return {};
      }
      const anchorId =
        slot.kind === "rootEmpty" || slot.kind === "rootCanvas" || slot.kind === "rootAppend"
          ? (ctx.dndRoot[ctx.dndRoot.length - 1]?.id ?? drag.i)
          : slot.id;
      const tileBand =
        slot.kind === "root"
          ? resolveRootTileDropBand(
              state.targetElement,
              rootPos,
              ctx.pointerClient,
            )
          : undefined;
      const listPos: "before" | "after" =
        tileBand && tileBand !== "center" ? tileBand : rootPos;
      const next =
        slot.kind === "root" && tileBand === "center"
          ? swapDndListById(ctx.dndRoot, drag.i, anchorId)
          : reorderRootDrag(ctx.dndRoot, drag.i, slot, anchorId, listPos);
      const mode =
        slot.kind === "rootRowEnd"
          ? "rowEnd"
          : slot.kind === "rootGapAfter"
            ? "gapAfter"
            : slot.kind === "rootEmpty" || slot.kind === "rootCanvas" || slot.kind === "rootAppend"
              ? "canvas"
              : "tileSlot";
      commitRootListReorder(ctx, next, ctx.dndByGroup, drag.i, anchorId, rootPos, mode, persist, tileBand);
      return { nextDndRoot: next };
    }
    if (isGroupSurfaceSlot(slot)) {
      const { next: rootWithout, removed } = removeById(ctx.dndRoot, drag.i);
      if (!removed) return {};
      const gid = slot.groupId;
      const gList = dedupeById(ctx.dndByGroup[gid] ?? []);
      let nextG: DashboardDndListItem[];
      if (isGroupEndSlot(slot)) {
        nextG = dedupeById([...gList, removed]);
      } else if (slot.kind === "groupGapAfter") {
        nextG = insertRelativeTo(gList, removed, slot.childId, "after");
      } else if (slot.kind === "groupChild") {
        const tileBand = resolveRootTileDropBand(state.targetElement, pos, ctx.pointerClient);
        const listPos: "before" | "after" =
          tileBand && tileBand !== "center" ? tileBand : pos;
        nextG = insertRelativeTo(gList, removed, slot.childId, listPos);
      } else {
        /* c8 ignore next 2 -- exhaustive isGroupSurfaceSlot arms handled above */
        nextG = gList;
      }
      const nextBy = { ...ctx.dndByGroup, [gid]: nextG };
      commitLayout(ctx, dedupeById(rootWithout), nextBy, persist);
      return { nextDndRoot: dedupeById(rootWithout), nextDndByGroup: nextBy };
    }
  }

  // Group child
  if (drag.k === "cg") {
    const fromG = drag.g;
    const childId = drag.i;
    if (isRootSurfaceSlot(slot)) {
      // Ignore drops that resolve to the source root-group shell while dragging one
      // of that group's children. Without this guard, the child can be promoted to root
      // if pointer hit-testing resolves to the outer shell on drop.
      if (
        (slot.kind === "root" || slot.kind === "rootRowEnd" || slot.kind === "rootGapAfter") &&
        slot.id === fromG
      ) {
        return {};
      }
      const { next: gListWithout, removed } = removeById(dedupeById(ctx.dndByGroup[fromG] ?? []), childId);
      if (!removed) return {};
      const rootList = ctx.dndRoot;
      const anchorId =
        slot.kind === "rootEmpty" || slot.kind === "rootCanvas" || slot.kind === "rootAppend"
          ? (ctx.dndRoot[ctx.dndRoot.length - 1]?.id ?? removed.id)
          : slot.id;
      const tileBand =
        slot.kind === "root"
          ? resolveRootTileDropBand(state.targetElement, rootPos, ctx.pointerClient)
          : undefined;
      const listPos: "before" | "after" =
        tileBand && tileBand !== "center" ? tileBand : rootPos;
      const inserted =
        slot.kind === "rootEmpty" || slot.kind === "rootCanvas" || slot.kind === "rootAppend"
          ? dedupeById([...rootList, removed])
          : insertRelativeTo(rootList, removed, anchorId, listPos);
      const nextRoot =
        slot.kind === "root" && tileBand === "center"
          ? swapDndListById(inserted, removed.id, anchorId)
          : inserted;
      const nextBy = { ...ctx.dndByGroup, [fromG]: dedupeById(gListWithout) };
      const mode =
        slot.kind === "rootEmpty" || slot.kind === "rootCanvas" || slot.kind === "rootAppend"
          ? "canvas"
          : "tileSlot";
      commitRootListReorder(ctx, nextRoot, nextBy, removed.id, anchorId, rootPos, mode, persist, tileBand);
      return { nextDndRoot: nextRoot, nextDndByGroup: nextBy };
    }
    if (isGroupSurfaceSlot(slot)) {
      const toG = slot.groupId;
      const fromList = dedupeById(ctx.dndByGroup[fromG] ?? []);
      if (fromG === toG) {
        let nextTo: DashboardDndListItem[];
        if (isGroupEndSlot(slot)) {
          const { next: w, removed } = removeById(fromList, childId);
          if (!removed) return {};
          nextTo = dedupeById([...w, removed]);
        } else if (slot.kind === "groupGapAfter") {
          const { next: w, removed } = removeById(fromList, childId);
          if (!removed) return {};
          nextTo = insertRelativeTo(w, removed, slot.childId, "after");
        } else if (slot.kind === "groupChild") {
          nextTo = reorderGroupChildDrag(
            fromList,
            childId,
            slot.childId,
            pos,
            state.targetElement,
            ctx.pointerClient,
          );
        } else {
          /* c8 ignore next 2 -- exhaustive same-group group-surface arms handled above */
          return {};
        }
        const nextBy = { ...ctx.dndByGroup, [fromG]: dedupeById(nextTo) };
        commitLayout(ctx, ctx.dndRoot, nextBy, persist);
        return { nextDndByGroup: nextBy };
      }
      const { next: fromWithout, removed } = removeById(fromList, childId);
      if (!removed) return {};
      const toList = dedupeById(ctx.dndByGroup[toG] ?? []);
      let nextTarget: DashboardDndListItem[];
      if (isGroupEndSlot(slot)) {
        nextTarget = dedupeById([...toList, removed]);
      } else if (slot.kind === "groupGapAfter") {
        nextTarget = insertRelativeTo(toList, removed, slot.childId, "after");
      } else if (slot.kind === "groupChild") {
        const tileBand = resolveRootTileDropBand(state.targetElement, pos, ctx.pointerClient);
        const listPos: "before" | "after" =
          tileBand && tileBand !== "center" ? tileBand : pos;
        nextTarget = insertRelativeTo(toList, removed, slot.childId, listPos);
      } else {
        /* c8 ignore next 2 -- exhaustive cross-group group-surface arms handled above */
        nextTarget = toList;
      }
      const nextBy = {
        ...ctx.dndByGroup,
        [fromG]: dedupeById(fromWithout),
        [toG]: dedupeById(nextTarget),
      };
      commitLayout(ctx, ctx.dndRoot, nextBy, persist);
      return { nextDndByGroup: nextBy };
    }
  }

  return {};
}

/** Mark drops on inner strips of the same root group as invalid while dragging that root group. */
export function applyDashboardInvalidDrop(
  state: DragDropState<DashboardDragPayload>,
  dndRoot: DashboardDndListItem[],
): void {
  const drag = parseDragPayload(state.draggedItem) ?? (state.draggedItem as DashboardDragPayload);
  state.invalidDrop = false;
  const isPaletteDrag = drag?.k === "pp" || drag?.k === "pg";
  const canvasContainers = new Set([ROOT_EMPTY_CONTAINER, ROOT_CANVAS_CONTAINER, ROOT_APPEND_CONTAINER]);
  if (
    !isPaletteDrag &&
    state.targetContainer &&
    canvasContainers.has(state.targetContainer) &&
    state.targetElement instanceof Element &&
    state.targetElement.closest('[data-dashboard-editor="tile-row"]') &&
    !state.targetElement.closest("[data-editor-root-surface-drop]") &&
    !state.targetElement.closest("[data-editor-group-surface-drop]")
  ) {
    state.invalidDrop = true;
    return;
  }
  if (drag?.k !== "cr" || !state.targetContainer) return;
  const wrap = findListItem(dndRoot, drag.i);
  if (!wrap || !isDndCellGroup(wrap.item)) return;
  const gid = wrap.item.id;
  if (state.targetContainer.startsWith(`g:${gid}:`)) state.invalidDrop = true;
}
