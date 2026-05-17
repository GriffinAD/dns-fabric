import type { DashboardGroup, DashboardTile, GroupChild, RootLayoutItem, RootTileItem } from "../types";
import { isDashboardGroupNode } from "../types";
import { dedupeById } from "./layoutDedupe";

export { compareRootItemsByPosition } from "./layoutCompare";
export { dedupeById } from "./layoutDedupe";
export {
  dedupeLayoutV2ItemIds,
  dedupeLayoutV3ItemIds,
  ensureLayoutV2,
  ensureLayoutV3,
  layoutGraphHasDuplicateIds,
  layoutMaxNestedGroupDepth,
  layoutNestedGroupDepthExceeded,
  migrateV1ToV2,
  migrateV2ToV3,
} from "../migration";

/** `select` / settings value: tile lives on the **root** dashboard grid (not inside a container). */
export const PARENT_ID_DASHBOARD = "__dashboard__";

function* iterateTilesInGroupChildren(children: GroupChild[]): Generator<DashboardTile, void, undefined> {
  for (const c of children) {
    if (isDashboardGroupNode(c)) {
      yield* iterateTilesInGroupChildren(c.children);
    } else {
      yield c;
    }
  }
}

export function* iterateTilesInLayout(
  items: RootLayoutItem[],
): Generator<DashboardTile, void, undefined> {
  for (const it of items) {
    if (it.kind === "tile") {
      yield it;
    } else {
      yield* iterateTilesInGroupChildren(it.children);
    }
  }
}

function findTileInGroupChildren(
  children: GroupChild[],
  tileId: string,
  immediateParent: DashboardGroup,
): { tile: DashboardTile; inGroup: DashboardGroup } | null {
  for (const c of children) {
    if (isDashboardGroupNode(c)) {
      const deeper = findTileInGroupChildren(c.children, tileId, c);
      if (deeper) return deeper;
    } else if (c.id === tileId) {
      return { tile: c, inGroup: immediateParent };
    }
  }
  return null;
}

/** Every `kind: "group"` in the layout tree (root and nested), depth-first. */
export function collectAllGroupsInLayout(items: RootLayoutItem[]): DashboardGroup[] {
  const out: DashboardGroup[] = [];
  function walkGroup(g: DashboardGroup) {
    out.push(g);
    for (const c of dedupeById(g.children)) {
      if (isDashboardGroupNode(c)) walkGroup(c);
    }
  }
  for (const it of items) {
    if (it.kind === "group") walkGroup(it);
  }
  return out;
}

export function findTileInLayout(
  items: RootLayoutItem[],
  tileId: string,
): { tile: DashboardTile; inGroup: DashboardGroup | null } | null {
  for (const it of items) {
    if (it.kind === "tile") {
      if (it.id === tileId) return { tile: it, inGroup: null };
    } else {
      const inner = findTileInGroupChildren(it.children, tileId, it);
      if (inner) return inner;
    }
  }
  return null;
}

function mapTileInGroupChildren(
  children: GroupChild[],
  tileId: string,
  mapFn: (t: DashboardTile) => DashboardTile,
): GroupChild[] {
  return children.map((c) => {
    if (isDashboardGroupNode(c)) {
      return { ...c, children: mapTileInGroupChildren(c.children, tileId, mapFn) };
    }
    return c.id === tileId ? mapFn(c) : c;
  });
}

export function mapTileInLayout(
  items: RootLayoutItem[],
  tileId: string,
  mapFn: (t: DashboardTile) => DashboardTile,
): RootLayoutItem[] {
  return items.map((it) => {
    if (it.kind === "tile") {
      if (it.id === tileId) return mapFn(it) as RootTileItem;
      return it;
    }
    return {
      ...it,
      children: mapTileInGroupChildren(it.children, tileId, mapFn),
    };
  });
}

export function mapRootItemsReplaceGroup(
  items: RootLayoutItem[],
  groupId: string,
  next: DashboardGroup,
): RootLayoutItem[] {
  return items.map((it) => (it.kind === "group" && it.id === groupId ? next : it));
}

function mapReplaceGroupInGroupChildren(
  children: GroupChild[],
  groupId: string,
  next: DashboardGroup,
): GroupChild[] {
  return children.map((c) => {
    if (isDashboardGroupNode(c)) {
      if (c.id === groupId) return next;
      return { ...c, children: mapReplaceGroupInGroupChildren(c.children, groupId, next) };
    }
    return c;
  });
}

/** Replace a dashboard group at the root or any nesting depth (by stable group id). */
export function mapLayoutReplaceGroupById(
  items: RootLayoutItem[],
  groupId: string,
  next: DashboardGroup,
): RootLayoutItem[] {
  return items.map((it) => {
    if (it.kind === "group" && it.id === groupId) return next;
    if (it.kind === "group") {
      return { ...it, children: mapReplaceGroupInGroupChildren(it.children, groupId, next) };
    }
    return it;
  });
}

function removeGroupFromGroupChildren(children: GroupChild[], groupId: string): GroupChild[] {
  const out: GroupChild[] = [];
  for (const c of children) {
    if (isDashboardGroupNode(c)) {
      if (c.id === groupId) continue;
      out.push({ ...c, children: removeGroupFromGroupChildren(c.children, groupId) });
    } else {
      out.push(c);
    }
  }
  return out;
}

/** Remove a group (root or nested) and its subtree; tiles and other groups are unchanged. */
export function removeLayoutGroupById(items: RootLayoutItem[], groupId: string): RootLayoutItem[] {
  const filtered = items.filter((it) => !(it.kind === "group" && it.id === groupId));
  return filtered.map((it) =>
    it.kind === "group" ? { ...it, children: removeGroupFromGroupChildren(it.children, groupId) } : it,
  );
}

function removeTileFromGroupChildren(children: GroupChild[], tileId: string): GroupChild[] {
  const out: GroupChild[] = [];
  for (const c of children) {
    if (isDashboardGroupNode(c)) {
      out.push({ ...c, children: removeTileFromGroupChildren(c.children, tileId) });
    } else if (c.id !== tileId) {
      out.push(c);
    }
  }
  return out;
}

/** Remove a tile from root or from any nested group (keeps empty groups). */
export function removeTileFromAnywhere(items: RootLayoutItem[], tileId: string): RootLayoutItem[] {
  const out: RootLayoutItem[] = [];
  for (const it of items) {
    if (it.kind === "tile") {
      if (it.id !== tileId) out.push(it);
    } else {
      out.push({
        ...it,
        children: removeTileFromGroupChildren(it.children, tileId),
      });
    }
  }
  return out;
}

function stripRowPanel(t: DashboardTile): DashboardTile {
  const { rowPanel: _rp, ...rest } = t as DashboardTile & { rowPanel?: string };
  return rest as DashboardTile;
}

function insertTileIntoGroupChildren(children: GroupChild[], groupId: string, tile: DashboardTile): GroupChild[] {
  return children.map((c) => {
    if (isDashboardGroupNode(c)) {
      if (c.id === groupId) return { ...c, children: [...c.children, tile] };
      return { ...c, children: insertTileIntoGroupChildren(c.children, groupId, tile) };
    }
    return c;
  });
}

function insertTileIntoGroup(items: RootLayoutItem[], groupId: string, tile: DashboardTile): RootLayoutItem[] {
  return items.map((it) => {
    if (it.kind === "group" && it.id === groupId) {
      return { ...it, children: [...it.children, tile] };
    }
    if (it.kind === "group") {
      return { ...it, children: insertTileIntoGroupChildren(it.children, groupId, tile) };
    }
    return it;
  });
}

/** Append a tile to the group with `groupId` (searched recursively). */
export function appendTileToGroupInItems(
  items: RootLayoutItem[],
  groupId: string,
  tile: DashboardTile,
): RootLayoutItem[] {
  return insertTileIntoGroup(items, groupId, tile);
}

function insertGroupIntoGroupChildren(
  children: GroupChild[],
  parentGroupId: string,
  newGroup: DashboardGroup,
): GroupChild[] {
  return children.map((c) => {
    if (isDashboardGroupNode(c)) {
      if (c.id === parentGroupId) {
        return { ...c, children: [...c.children, newGroup] };
      }
      return { ...c, children: insertGroupIntoGroupChildren(c.children, parentGroupId, newGroup) };
    }
    return c;
  });
}

/** Append an empty nested container to the group with `groupId` (searched recursively). */
export function appendGroupToGroupInItems(
  items: RootLayoutItem[],
  parentGroupId: string,
  newGroup: DashboardGroup,
): RootLayoutItem[] {
  return items.map((it) => {
    if (it.kind === "group" && it.id === parentGroupId) {
      return { ...it, children: [...it.children, newGroup] };
    }
    if (it.kind === "group") {
      return { ...it, children: insertGroupIntoGroupChildren(it.children, parentGroupId, newGroup) };
    }
    return it;
  });
}

function findGroupByIdInChildren(children: GroupChild[], groupId: string): DashboardGroup | null {
  for (const c of children) {
    if (isDashboardGroupNode(c)) {
      if (c.id === groupId) return c;
      const inner = findGroupByIdInChildren(c.children, groupId);
      if (inner) return inner;
    }
  }
  return null;
}

export function findGroupByIdInItems(items: RootLayoutItem[], groupId: string): DashboardGroup | null {
  for (const it of items) {
    if (it.kind === "group") {
      if (it.id === groupId) return it;
      const inner = findGroupByIdInChildren(it.children, groupId);
      if (inner) return inner;
    }
  }
  return null;
}

/**
 * Reparent a tile to the root grid or to a group’s children (any depth). Strips v1 `rowPanel`.
 * Caller should run `layoutWithGrid` / pack on the result.
 */
export function moveTileToParent(
  items: RootLayoutItem[],
  tileId: string,
  target: { type: "root" } | { type: "group"; groupId: string },
  tileData: DashboardTile,
): RootLayoutItem[] {
  const base = stripRowPanel(tileData);
  const without = removeTileFromAnywhere(items, tileId);
  if (target.type === "root") {
    const asRoot: RootTileItem = { ...base, kind: "tile" };
    return [...without, asRoot];
  }
  return insertTileIntoGroup(without, target.groupId, base);
}
