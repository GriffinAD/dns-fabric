/**
 * Merge svelte-dnd-action lists back into a layout document (supports nested groups in v3).
 */
import {
  groupOuterColSpan,
  packGroupChildrenRowWrapInOrder,
  reorderTilesPreservingSlotOrigins,
} from "./gridPlacement";
import { findGroupByIdInItems } from "./layoutTree";
import type { DashboardGroup, DashboardTile, GroupChild, RootLayoutItem } from "./types";
import { isDashboardGroupNode } from "./types";

export type DashboardDndCell = RootLayoutItem | GroupChild;

export type DashboardDndListItem = { id: string; item: DashboardDndCell };

export function isDndCellGroup(cell: DashboardDndCell): cell is DashboardGroup {
  return isDashboardGroupNode(cell as GroupChild);
}

/** Narrow a group DnD row to `DashboardTile` for tile-only editor zones (throws if the row is a group). */
export function dndListItemToDashboardTile(c: DashboardDndListItem): DashboardTile {
  if (isDndCellGroup(c.item)) {
    throw new Error("expected a tile in group DnD list");
  }
  const { kind: _k, ...tile } = c.item as DashboardTile & { kind?: "tile" };
  return tile as DashboardTile;
}

function applyGroupTileReorder(prev: DashboardGroup, reorderedTiles: DashboardTile[]): DashboardTile[] {
  if (prev.innerWrap === true) {
    return packGroupChildrenRowWrapInOrder(reorderedTiles, groupOuterColSpan(prev));
  }
  const prevTiles = prev.children.filter((c): c is DashboardTile => !isDashboardGroupNode(c));
  return reorderTilesPreservingSlotOrigins(prevTiles, reorderedTiles, false);
}

export function finalizeGroupChildrenFromDnd(
  prev: DashboardGroup,
  dndList: DashboardDndListItem[],
  dndByGroup: Record<string, DashboardDndListItem[]>,
): GroupChild[] {
  const synced: GroupChild[] = dndList.map((d) => {
    const p = prev.children.find((x) => x.id === d.id);
    if (!p) return d.item as GroupChild;
    if (isDashboardGroupNode(p)) {
      const innerList = dndByGroup[p.id] ?? p.children.map((ch) => ({ id: ch.id, item: ch }));
      return { ...p, children: finalizeGroupChildrenFromDnd(p, innerList, dndByGroup) };
    }
    return p;
  });

  const newTiles = synced.filter((c): c is DashboardTile => !isDashboardGroupNode(c));
  const permutedTiles = applyGroupTileReorder(prev, newTiles);
  const tileById = new Map(permutedTiles.map((t) => [t.id, t]));
  const out: GroupChild[] = [];
  for (const c of synced) {
    if (isDashboardGroupNode(c)) {
      out.push(c);
    } else {
      const t = tileById.get(c.id);
      if (t) out.push(t);
    }
  }
  return out;
}

export function buildRootLayoutFromDnd(
  layoutItems: RootLayoutItem[],
  dndRoot: DashboardDndListItem[],
  dndByGroup: Record<string, DashboardDndListItem[]>,
): RootLayoutItem[] {
  return dndRoot.map((row) => {
    const it = row.item;
    if (isDndCellGroup(it)) {
      const prevG = findGroupByIdInItems(layoutItems, it.id);
      if (!prevG) {
        return it;
      }
      const list = dndByGroup[it.id] ?? prevG.children.map((ch) => ({ id: ch.id, item: ch }));
      const nextChildren = finalizeGroupChildrenFromDnd(prevG, list, dndByGroup);
      return { ...prevG, children: nextChildren } satisfies RootLayoutItem;
    }
    return { ...it } as RootLayoutItem;
  });
}
