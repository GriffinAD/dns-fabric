/**
 * Layout document upgrades (v1 → v2 dedupe/migrate, v2 → v3 version bump). Pure functions; no I/O.
 * Call from persistence hydrate path after wire parse.
 */
import { compareRootItemsByPosition } from "../layout/layoutCompare";
import { dedupeById } from "../layout/layoutDedupe";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV1,
  DashboardLayoutV2,
  DashboardLayoutV3,
  DashboardTile,
  GroupChild,
  RootLayoutItem,
  RootTileItem,
} from "../types";
import { normalizeTabChildPaneGroups, wrapTabTileInPaneGroup } from "../groups/tabGroupOps";
import {
  isDashboardGroupNode,
  isLayoutV2,
  isLayoutV3,
  MAX_DASHBOARD_GROUP_DEPTH,
} from "../types";

/** Wrapper group id for legacy tile-level `hostControl: "tab-control"` (ADR-0054). */
export function tabGroupWrapperId(tileId: string): string {
  return `tab-group-${tileId}`;
}

/**
 * Legacy tile-level `hostControl: "tab-control"` (ADR-0049 placeholder era) becomes a tab
 * container group: same root `grid`, one `single-panel` child, `hostState.activeChildId` = child id.
 */
export function wrapLegacyTabControlTile(tile: DashboardTile): DashboardGroup {
  const { hostControl: _hc, ...rest } = tile;
  const child: DashboardTile = {
    ...rest,
    hostControl: "single-panel",
    tabLabel: tile.tabLabel ?? tile.pluginId,
  };
  const pane = wrapTabTileInPaneGroup(child);
  return {
    kind: "group",
    id: tabGroupWrapperId(tile.id),
    showBorder: true,
    hostControl: "tab-control",
    hostState: { activeChildId: pane.id },
    grid: tile.grid,
    children: [pane],
  };
}

function migrateLegacyTabControlInChildren(children: GroupChild[]): GroupChild[] {
  let changed = false;
  const next = children.map((c) => {
    if (isDashboardGroupNode(c)) {
      let group = c;
      if (c.hostControl === "tab-control") {
        const normalized = normalizeTabChildPaneGroups(c);
        if (normalized !== c) {
          changed = true;
          group = normalized;
        }
      }
      const migratedChildren = migrateLegacyTabControlInChildren(group.children);
      if (migratedChildren !== group.children) {
        changed = true;
        return { ...group, children: migratedChildren };
      }
      return group;
    }
    if (c.hostControl === "tab-control") {
      changed = true;
      return wrapLegacyTabControlTile(c);
    }
    return c;
  });
  return changed ? next : children;
}

/** Upgrade any remaining tile-level `tab-control` nodes to group tab containers. */
export function migrateLegacyTabControlItems(items: RootLayoutItem[]): RootLayoutItem[] {
  let changed = false;
  const next = items.map((it) => {
    if (it.kind === "group") {
      let group = it;
      if (it.hostControl === "tab-control") {
        const normalized = normalizeTabChildPaneGroups(it);
        if (normalized !== it) {
          changed = true;
          group = normalized;
        }
      }
      const children = migrateLegacyTabControlInChildren(group.children);
      if (children !== group.children) {
        changed = true;
        return { ...group, children };
      }
      return group;
    }
    if (it.hostControl === "tab-control") {
      changed = true;
      return wrapLegacyTabControlTile(it);
    }
    return it;
  });
  return changed ? next : items;
}

function finalizeLayoutV3(layout: DashboardLayoutV3): DashboardLayoutV3 {
  let items = layout.items;
  let changed = false;
  if (layoutGraphHasDuplicateIds(items)) {
    items = dedupeLayoutV3ItemIds({ version: 3, items }).items;
    changed = true;
  }
  const migrated = migrateLegacyTabControlItems(items);
  if (migrated !== items) {
    items = migrated;
    changed = true;
  }
  if (!changed) return layout;
  return { version: 3, items };
}

function deepCloneItems(items: RootLayoutItem[]): RootLayoutItem[] {
  return JSON.parse(JSON.stringify(items)) as RootLayoutItem[];
}

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
    const children: GroupChild[] = sorted.map((t) => {
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

function dedupeNestedGroupChildren(children: GroupChild[]): GroupChild[] {
  return dedupeById(children).map((c) =>
    isDashboardGroupNode(c) ? { ...c, children: dedupeNestedGroupChildren(c.children) } : c,
  );
}

function collectIdsFromChildren(children: GroupChild[], into: Set<string>): boolean {
  for (const c of children) {
    if (into.has(c.id)) return true;
    into.add(c.id);
    if (isDashboardGroupNode(c) && collectIdsFromChildren(c.children, into)) return true;
  }
  return false;
}

/** True if any `id` appears more than once anywhere in the layout graph. */
export function layoutGraphHasDuplicateIds(items: RootLayoutItem[]): boolean {
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.id)) return true;
    seen.add(it.id);
    if (it.kind === "group" && collectIdsFromChildren(it.children, seen)) return true;
  }
  return false;
}

/** Deepest group nesting along any path (root-level group = 1). */
export function layoutMaxNestedGroupDepth(items: RootLayoutItem[]): number {
  function fromChildren(children: GroupChild[], parentDepth: number): number {
    let m = parentDepth;
    for (const c of children) {
      if (isDashboardGroupNode(c)) {
        const d = parentDepth + 1;
        m = Math.max(m, d, fromChildren(c.children, d));
      }
    }
    return m;
  }
  let max = 0;
  for (const it of items) {
    if (it.kind === "group") {
      max = Math.max(max, 1, fromChildren(it.children, 1));
    }
  }
  return max;
}

export function layoutNestedGroupDepthExceeded(items: RootLayoutItem[]): boolean {
  return layoutMaxNestedGroupDepth(items) > MAX_DASHBOARD_GROUP_DEPTH;
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
        it.kind === "group" ? { ...it, children: dedupeNestedGroupChildren(it.children) } : it,
      ),
    ),
  };
}

export function dedupeLayoutV3ItemIds(layout: DashboardLayoutV3): DashboardLayoutV3 {
  return {
    version: 3,
    items: dedupeById(
      layout.items.map((it) =>
        it.kind === "group" ? { ...it, children: dedupeNestedGroupChildren(it.children) } : it,
      ),
    ),
  };
}

export function ensureLayoutV2(layout: DashboardLayout): DashboardLayoutV2 {
  if (isLayoutV2(layout)) {
    if (!layoutGraphHasDuplicateIds(layout.items)) return layout;
    return dedupeLayoutV2ItemIds(layout);
  }
  if (isLayoutV3(layout)) {
    return { version: 2, items: layout.items };
  }
  const v2: DashboardLayoutV2 = { version: 2, items: migrateV1ToV2((layout as DashboardLayoutV1).tiles) };
  if (!layoutGraphHasDuplicateIds(v2.items)) return v2;
  return dedupeLayoutV2ItemIds(v2);
}

/** Structural v2 → v3 bump (v2 layouts are a subset: only tiles inside groups). */
export function migrateV2ToV3(layout: DashboardLayoutV2): DashboardLayoutV3 {
  const v2 = dedupeLayoutV2ItemIds(layout);
  return { version: 3, items: deepCloneItems(v2.items) };
}

export function ensureLayoutV3(layout: DashboardLayout): DashboardLayoutV3 {
  if (isLayoutV3(layout)) {
    return finalizeLayoutV3(layout);
  }
  const v2 = ensureLayoutV2(layout);
  const v3 = migrateV2ToV3(v2);
  return finalizeLayoutV3(v3);
}
