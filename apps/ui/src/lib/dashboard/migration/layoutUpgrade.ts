/**
 * Layout document upgrades (v1 → v2 dedupe/migrate). Pure functions; no I/O.
 * Call from persistence hydrate path after wire parse.
 */
import { compareRootItemsByPosition } from "../layoutCompare";
import { dedupeById } from "../layoutDedupe";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV2,
  DashboardTile,
  RootLayoutItem,
  RootTileItem,
} from "../types";
import { isLayoutV2 } from "../types";

/**
 * v1 `rowPanel` → one `group` per distinct id, with child grids translated into the
 * group’s local coordinate system.
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
    const idSlug = pid.replace(/[^a-z0-9-]+/gi, "-").slice(0, 32);
    const g: DashboardGroup = {
      kind: "group",
      id: `group-${idSlug}`,
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
