import type { DragDropState } from "@thisux/sveltednd";

import type { DashboardDndListItem } from "../groupDndFinalize";
import { buildRootLayoutFromDnd, isDndCellGroup } from "../groupDndFinalize";
import { dedupeById } from "../layoutTree";
import { packRootLayoutItems, reorderRootLayoutItemsPreservingSlotOrigins } from "../gridPlacement";
import type { DashboardLayout, RootLayoutItem } from "../types";

import {
  type DashboardDragPayload,
  parseDragPayload,
  parseDropContainer,
  type ParsedDropSlot,
  ROOT_EMPTY_CONTAINER,
} from "./dashboardSveltedndTypes";

export type DashboardDropContext = {
  dndRoot: DashboardDndListItem[];
  dndByGroup: Record<string, DashboardDndListItem[]>;
  layoutItems: RootLayoutItem[];
  onLayoutStructureChange?: (next: DashboardLayout) => void;
  onAddTile?: (pluginId: string, insertBeforeIndex?: number) => void;
  onAddGroup?: (insertBeforeIndex?: number) => void;
  onAddTileToGroup?: (groupId: string, pluginId: string) => void;
  onAddGroupToGroup?: (parentGroupId: string) => void;
};

export type DashboardDropResult = {
  nextDndRoot?: DashboardDndListItem[];
  nextDndByGroup?: Record<string, DashboardDndListItem[]>;
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
  options?: { compactRoot?: boolean },
) {
  const merged = buildRootLayoutFromDnd(ctx.layoutItems, nextRoot, nextBy);
  const items = options?.compactRoot
    ? packRootLayoutItems(merged)
    : reorderRootLayoutItemsPreservingSlotOrigins(ctx.layoutItems, merged);
  ctx.onLayoutStructureChange?.({ version: 3, items });
}

function rootInsertIndex(dndRoot: DashboardDndListItem[], slot: ParsedDropSlot, dropPosition: "before" | "after"): number {
  if (slot.kind === "rootEmpty") return dndRoot.length;
  if (slot.kind !== "root" && slot.kind !== "rootRowEnd") return dndRoot.length;
  const idx = dndRoot.findIndex((d) => d.id === slot.id);
  if (idx < 0) return dndRoot.length;
  if (slot.kind === "rootRowEnd") return idx + 1;
  return dropPosition === "before" ? idx : idx + 1;
}

/**
 * Apply a successful drop from @thisux/sveltednd. Caller should ensure `!state.invalidDrop`
 * and that `state.dropPosition` is set when required.
 */
export function applyDashboardDrop(
  state: DragDropState<DashboardDragPayload>,
  ctx: DashboardDropContext,
): DashboardDropResult {
  const drag = parseDragPayload(state.draggedItem) ?? (state.draggedItem as DashboardDragPayload);
  const slot = parseDropContainer(state.targetContainer);
  const pos = state.dropPosition ?? "before";
  const rootPos: "before" | "after" = slot?.kind === "rootRowEnd" ? "after" : pos;

  if (!slot) return {};

  // Palette → root (root-group shells commit into that group)
  if (drag.k === "pp" && (slot.kind === "root" || slot.kind === "rootRowEnd" || slot.kind === "rootEmpty")) {
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
  if (drag.k === "pg" && (slot.kind === "root" || slot.kind === "rootRowEnd" || slot.kind === "rootEmpty")) {
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

  // Palette → group
  if (drag.k === "pp" && (slot.kind === "groupChild" || slot.kind === "groupEmpty")) {
    ctx.onAddTileToGroup?.(slot.groupId, drag.i);
    return {};
  }
  if (drag.k === "pg" && (slot.kind === "groupChild" || slot.kind === "groupEmpty")) {
    ctx.onAddGroupToGroup?.(slot.groupId);
    return {};
  }

  // Root cell
  if (drag.k === "cr") {
    const draggedRoot = findListItem(ctx.dndRoot, drag.i);
    const draggingRootGroup = draggedRoot ? isDndCellGroup(draggedRoot.item) : false;
    // No-op when a root row resolves to its own root slot on drop.
    if ((slot.kind === "root" || slot.kind === "rootRowEnd") && slot.id === drag.i) {
      return {};
    }
    // Defensive: if a root group resolves to one of its own inner slots at drop time,
    // keep this as a no-op instead of moving/removing the container.
    if (
      draggingRootGroup &&
      ((slot.kind === "groupChild" && slot.groupId === drag.i) || (slot.kind === "groupEmpty" && slot.groupId === drag.i))
    ) {
      return {};
    }
    if (slot.kind === "root" || slot.kind === "rootRowEnd" || slot.kind === "rootEmpty") {
      if (slot.kind === "rootEmpty" && ctx.dndRoot.length === 0) return {};
      if (slot.kind === "rootEmpty" && ctx.dndRoot.length > 0) {
        const next = reorderByTarget(ctx.dndRoot, drag.i, ctx.dndRoot[ctx.dndRoot.length - 1]!.id, "after");
        commitLayout(ctx, next, ctx.dndByGroup);
        return { nextDndRoot: next };
      }
      if (slot.kind !== "root" && slot.kind !== "rootRowEnd") return {};
      const next = reorderByTarget(ctx.dndRoot, drag.i, slot.id, rootPos);
      commitLayout(ctx, next, ctx.dndByGroup, { compactRoot: slot.kind === "rootRowEnd" });
      return { nextDndRoot: next };
    }
    if (slot.kind === "groupChild" || slot.kind === "groupEmpty") {
      const { next: rootWithout, removed } = removeById(ctx.dndRoot, drag.i);
      if (!removed) return {};
      const gid = slot.groupId;
      const gList = dedupeById(ctx.dndByGroup[gid] ?? []);
      const nextG =
        slot.kind === "groupEmpty"
          ? dedupeById([...gList, removed])
          : insertRelativeTo(gList, removed, slot.childId, pos);
      const nextBy = { ...ctx.dndByGroup, [gid]: nextG };
      commitLayout(ctx, dedupeById(rootWithout), nextBy);
      return { nextDndRoot: dedupeById(rootWithout), nextDndByGroup: nextBy };
    }
  }

  // Group child
  if (drag.k === "cg") {
    const fromG = drag.g;
    const childId = drag.i;
    if (slot.kind === "root" || slot.kind === "rootRowEnd" || slot.kind === "rootEmpty") {
      // Ignore drops that resolve to the source root-group shell while dragging one
      // of that group's children. Without this guard, the child can be promoted to root
      // if pointer hit-testing resolves to the outer shell on drop.
      if ((slot.kind === "root" || slot.kind === "rootRowEnd") && slot.id === fromG) {
        return {};
      }
      const { next: gListWithout, removed } = removeById(dedupeById(ctx.dndByGroup[fromG] ?? []), childId);
      if (!removed) return {};
      const rootList = ctx.dndRoot;
      const nextRoot =
        slot.kind === "rootEmpty"
          ? dedupeById([...rootList, removed])
          : insertRelativeTo(rootList, removed, slot.id, rootPos);
      const nextBy = { ...ctx.dndByGroup, [fromG]: dedupeById(gListWithout) };
      commitLayout(ctx, nextRoot, nextBy);
      return { nextDndRoot: nextRoot, nextDndByGroup: nextBy };
    }
    if (slot.kind === "groupChild" || slot.kind === "groupEmpty") {
      const toG = slot.groupId;
      const fromList = dedupeById(ctx.dndByGroup[fromG] ?? []);
      if (fromG === toG) {
        if (slot.kind === "groupEmpty") {
          const { next: w, removed } = removeById(fromList, childId);
          if (!removed) return {};
          const nextTo = dedupeById([...w, removed]);
          const nextBy = { ...ctx.dndByGroup, [fromG]: nextTo };
          commitLayout(ctx, ctx.dndRoot, nextBy);
          return { nextDndByGroup: nextBy };
        }
        const nextTo = reorderByTarget(fromList, childId, slot.childId, pos);
        const nextBy = { ...ctx.dndByGroup, [fromG]: dedupeById(nextTo) };
        commitLayout(ctx, ctx.dndRoot, nextBy);
        return { nextDndByGroup: nextBy };
      }
      const { next: fromWithout, removed } = removeById(fromList, childId);
      if (!removed) return {};
      const toList = dedupeById(ctx.dndByGroup[toG] ?? []);
      const nextTarget =
        slot.kind === "groupEmpty" ? dedupeById([...toList, removed]) : insertRelativeTo(toList, removed, slot.childId, pos);
      const nextBy = {
        ...ctx.dndByGroup,
        [fromG]: dedupeById(fromWithout),
        [toG]: dedupeById(nextTarget),
      };
      commitLayout(ctx, ctx.dndRoot, nextBy);
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
  if (
    state.targetContainer === ROOT_EMPTY_CONTAINER &&
    state.targetElement instanceof Element &&
    state.targetElement.closest('[data-dashboard-editor="tile-row"]')
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
