import type { DashboardGroup, DashboardTile, RootLayoutItem, RootTileItem } from "./types";
import { dedupeById } from "./layoutDedupe";

export { compareRootItemsByPosition } from "./layoutCompare";
export { dedupeById } from "./layoutDedupe";
export { dedupeLayoutV2ItemIds, ensureLayoutV2, migrateV1ToV2 } from "./migration";

/** `select` / settings value: tile lives on the **root** dashboard grid (not inside a container). */
export const PARENT_ID_DASHBOARD = "__dashboard__";

export function* iterateTilesInLayout(
  items: RootLayoutItem[],
): Generator<DashboardTile, void, undefined> {
  for (const it of items) {
    if (it.kind === "tile") {
      yield it;
    } else {
      for (const c of it.children) {
        yield c;
      }
    }
  }
}

export function findTileInLayout(
  items: RootLayoutItem[],
  tileId: string,
): { tile: DashboardTile; inGroup: DashboardGroup | null } | null {
  for (const it of items) {
    if (it.kind === "tile") {
      if (it.id === tileId) return { tile: it, inGroup: null };
    } else {
      const t = it.children.find((x) => x.id === tileId);
      if (t) return { tile: t, inGroup: it };
    }
  }
  return null;
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
      children: it.children.map((c) => (c.id === tileId ? mapFn(c) : c)),
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

/** Remove a tile from root or from any group’s `children` (keeps empty groups). */
export function removeTileFromAnywhere(items: RootLayoutItem[], tileId: string): RootLayoutItem[] {
  const out: RootLayoutItem[] = [];
  for (const it of items) {
    if (it.kind === "tile") {
      if (it.id !== tileId) out.push(it);
    } else {
      out.push({ ...it, children: it.children.filter((c) => c.id !== tileId) });
    }
  }
  return out;
}

function stripRowPanel(t: DashboardTile): DashboardTile {
  const { rowPanel: _rp, ...rest } = t as DashboardTile & { rowPanel?: string };
  return rest as DashboardTile;
}

/**
 * Reparent a tile to the root grid or to a group’s children. Strips v1 `rowPanel`.
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
  return without.map((it) => {
    if (it.kind === "group" && it.id === target.groupId) {
      return { ...it, children: [...it.children, { ...base }] };
    }
    return it;
  });
}
