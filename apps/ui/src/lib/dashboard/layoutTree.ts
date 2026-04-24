import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV2,
  DashboardTile,
  RootLayoutItem,
  RootTileItem,
} from "./types";
import { isLayoutV2 } from "./types";

/** `select` / settings value: tile lives on the root dashboard grid (not inside a container). */
export const PARENT_ID_DASHBOARD = "__dashboard__";

/**
 * Keeps the first occurrence of each `id`. Cross-zone DnD or bad saves can duplicate group
 * children; Svelte keyed `{#each ... (id)}` then throws `each_key_duplicate`.
 */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of items) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

function compareRootItemsByPosition(a: RootLayoutItem, b: RootLayoutItem): number {
  const g = (it: RootLayoutItem) => {
    if (it.kind === "group") {
      const o = it.grid;
      return { row: o?.row ?? 0, col: o?.col ?? 0 };
    }
    return { row: it.grid?.row ?? 0, col: it.grid?.col ?? 0 };
  };
  const pa = g(a);
  const pb = g(b);
  return pa.row - pb.row || pa.col - pb.col;
}

/**
 * v1 `rowPanel` → one `group` per distinct id, with child grids translated into the
 * group’s local coordinate system. (Obsolete v1-only read-path helpers were removed in P8.1.)
 */
export function migrateV1ToV2(tiles: DashboardTile[]): RootLayoutItem[] {
  const byPanel = new Map<string, DashboardTile[]>();
  const ungrouped: DashboardTile[] = [];
  for (const t of tiles) {
    const rp = t.rowPanel?.trim();
    if (rp) {
      if (!byPanel.has(rp)) byPanel.set(rp, []);
      byPanel.get(rp)!.push(t);
    } else {
      ungrouped.push(t);
    }
  }

  const items: RootLayoutItem[] = [];
  for (const t of ungrouped) {
    const { rowPanel: _rp, ...rest } = t;
    items.push({ ...rest, kind: "tile" } as RootTileItem);
  }

  for (const [pid, ts] of byPanel) {
    const sorted = [...ts].sort(
      (a, b) => (a.grid?.row ?? 0) - (b.grid?.row ?? 0) || (a.grid?.col ?? 0) - (b.grid?.col ?? 0),
    );
    const gs = sorted.map((x) => x.grid).filter((g): g is NonNullable<typeof g> => g != null);
    if (gs.length === 0) continue;
    const minR = Math.min(...gs.map((g) => g.row));
    const minC = Math.min(...gs.map((g) => g.col));
    const maxREnd = Math.max(...gs.map((g) => g.row + g.rowSpan));
    const maxCEnd = Math.max(...gs.map((g) => g.col + g.colSpan));
    const children: DashboardTile[] = sorted.map((t) => {
      const g = t.grid!;
      const { rowPanel: _rp, ...rest } = t;
      return {
        ...rest,
        grid: {
          col: g.col - minC,
          row: g.row - minR,
          colSpan: g.colSpan,
          rowSpan: g.rowSpan,
        },
      };
    });
    const safe = pid.replace(/[^a-z0-9-]+/gi, "-").slice(0, 32) || "panel";
    const g: DashboardGroup = {
      kind: "group",
      id: `group-${safe}`,
      showBorder: true,
      grid: { col: minC, row: minR, colSpan: maxCEnd - minC, rowSpan: maxREnd - minR },
      children,
    };
    items.push(g);
  }

  items.sort(compareRootItemsByPosition);
  return items;
}

function layoutItemsHaveDuplicateIds(items: RootLayoutItem[]): boolean {
  const root = new Set<string>();
  for (const it of items) {
    if (root.has(it.id)) return true;
    root.add(it.id);
    if (it.kind === "group") {
      const seen = new Set<string>();
      for (const c of it.children) {
        if (seen.has(c.id)) return true;
        seen.add(c.id);
      }
    }
  }
  return false;
}

/**
 * Deduplicate root items and every group’s `children` by `id` (first wins). Corrupt storage or
 * bad merges can otherwise repeat ids and Svelte’s keyed `{#each}` throws `each_key_duplicate`.
 */
export function dedupeLayoutV2ItemIds(layout: DashboardLayoutV2): DashboardLayoutV2 {
  return {
    version: 2,
    items: dedupeById(
      layout.items.map((it) =>
        it.kind === "group" ? { ...it, children: dedupeById(it.children) } : it,
      ),
    ),
  };
}

export function ensureLayoutV2(layout: DashboardLayout): DashboardLayoutV2 {
  if (isLayoutV2(layout)) {
    if (!layoutItemsHaveDuplicateIds(layout.items)) return layout;
    return dedupeLayoutV2ItemIds(layout);
  }
  const v2: DashboardLayoutV2 = { version: 2, items: migrateV1ToV2(layout.tiles) };
  if (!layoutItemsHaveDuplicateIds(v2.items)) return v2;
  return dedupeLayoutV2ItemIds(v2);
}

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
