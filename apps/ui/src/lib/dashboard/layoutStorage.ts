import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import { ensureLayoutV2, iterateTilesInLayout } from "./layoutTree";
import { cloneLayoutJson, layoutWithGrid } from "./gridPlacement";
import type {
  DashboardLayout,
  DashboardLayoutV1,
  DashboardLayoutV2,
  DashboardGroup,
  DashboardTile,
  RootLayoutItem,
  RootTileItem,
} from "./types";

const STORAGE_KEY = "kea-fabric-dashboard-layout";

const LEGACY_PLUGIN_IDS = new Set(["perf.summary"]);

const HOST_CONTROLS = new Set(["single-panel", "tab-control", "vertical-stack", "split-grid"]);
const DISPLAY_MODES = new Set(["compact", "full"]);

function validGridCell(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const g = value as Record<string, unknown>;
  const col = g.col;
  const row = g.row;
  const cspan = g.colSpan;
  const rspan = g.rowSpan;
  if (
    typeof col !== "number" ||
    typeof row !== "number" ||
    typeof cspan !== "number" ||
    typeof rspan !== "number"
  ) {
    return false;
  }
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    !Number.isInteger(cspan) ||
    !Number.isInteger(rspan)
  ) {
    return false;
  }
  if (!(col >= 0 && col <= 11 && cspan >= 1 && cspan <= 12 && col + cspan <= 12)) return false;
  if (row < 0 || rspan < 1 || rspan > 12) return false;
  return true;
}

function isTileOptions(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (o.cpu_total !== undefined && typeof o.cpu_total !== "boolean") return false;
  if (o.network_by_adapter !== undefined && typeof o.network_by_adapter !== "boolean") return false;
  if (o.disk_by_volume !== undefined && typeof o.disk_by_volume !== "boolean") return false;
  if (o.display_style !== undefined && o.display_style !== "gauge" && o.display_style !== "percent_only") {
    return false;
  }
  if (o.perf_max_cols !== undefined) {
    if (typeof o.perf_max_cols !== "number" || !Number.isInteger(o.perf_max_cols)) return false;
    if (o.perf_max_cols < 1 || o.perf_max_cols > 12) return false;
  }
  return true;
}

function isTile(value: unknown): value is DashboardTile {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  if (typeof t.id !== "string" || !t.id) return false;
  if (typeof t.pluginId !== "string" || !t.pluginId) return false;
  if (typeof t.hostControl !== "string" || !HOST_CONTROLS.has(t.hostControl)) return false;
  if (typeof t.displayMode !== "string" || !DISPLAY_MODES.has(t.displayMode)) return false;
  if (t.region !== undefined && typeof t.region !== "string") return false;
  if (t.rowPanel !== undefined) {
    if (typeof t.rowPanel !== "string" || t.rowPanel.length < 1 || t.rowPanel.length > 64) {
      return false;
    }
  }
  if (t.grid !== undefined && t.grid !== null && !validGridCell(t.grid)) return false;
  if (!isTileOptions(t.options)) return false;
  return true;
}

function isGroupNodeJson(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (o.kind !== "group") return false;
  if (typeof o.id !== "string" || !o.id) return false;
  if (o.showBorder !== undefined && typeof o.showBorder !== "boolean") return false;
  if (o.grid !== undefined && o.grid != null && !validGridCell(o.grid)) return false;
  if (!Array.isArray(o.children)) return false;
  for (const c of o.children) {
    if (!isTile(c)) return false;
  }
  return true;
}

function isRootTileV2(value: unknown): value is RootTileItem {
  if (!isTile(value)) return false;
  const t = value as unknown as Record<string, unknown>;
  if (t.kind !== "tile" && t.kind !== undefined) return false;
  return true;
}

function isRootItemV2(value: unknown): value is RootLayoutItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (o.kind === "group") return isGroupNodeJson(value);
  if (o.kind === "tile" || o.kind === undefined) return isRootTileV2(value);
  return false;
}

function parseV2(value: Record<string, unknown>): DashboardLayoutV2 | null {
  if (value.version !== 2 || !Array.isArray(value.items)) return null;
  const items: RootLayoutItem[] = [];
  for (const item of value.items) {
    if (!isRootItemV2(item)) return null;
    const o = item as unknown as Record<string, unknown>;
    if (o.kind === "group") {
      const g: DashboardGroup = { ...(item as object as DashboardGroup) };
      g.showBorder = g.showBorder !== false;
      items.push(g);
    } else {
      const t: Record<string, unknown> = { ...o };
      t.kind = "tile";
      items.push(t as unknown as RootTileItem);
    }
  }
  return { version: 2, items };
}

function parseV1(value: Record<string, unknown>): DashboardLayoutV1 | null {
  if (!Array.isArray(value.tiles)) return null;
  const tiles: DashboardTile[] = [];
  for (const item of value.tiles) {
    if (!isTile(item)) return null;
    tiles.push(item);
  }
  return { version: 1, tiles };
}

export function parseDashboardLayout(value: unknown): DashboardLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number" || v.version < 1) return null;
  if (v.version >= 2) {
    if (v.version !== 2) return null;
    return parseV2(v);
  }
  return parseV1(v);
}

export function loadDashboardLayout(): DashboardLayout | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseDashboardLayout(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveDashboardLayout(layout: DashboardLayout): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

function newMergedTileId(pluginId: string): string {
  const slug = pluginId.replace(/[^a-z0-9]+/gi, "-");
  return `tile-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Default tile rows (all plugins) for merge — inner + root. */
const DEFAULT_TILES: DashboardTile[] = [...iterateTilesInLayout(DEFAULT_DASHBOARD_LAYOUT.items)];

/** Add missing plugins from the built-in default (new tiles after upgrade). */
export function mergeMissingDefaultPlugins(layout: DashboardLayout): DashboardLayoutV2 {
  const v2 = ensureLayoutV2(layout);
  const present = new Set([...iterateTilesInLayout(v2.items)].map((t) => t.pluginId));
  const items = [...v2.items];
  for (const def of DEFAULT_TILES) {
    if (present.has(def.pluginId)) continue;
    const addition: RootTileItem = {
      kind: "tile",
      id: newMergedTileId(def.pluginId),
      pluginId: def.pluginId,
      hostControl: def.hostControl,
      displayMode: def.displayMode,
      region: def.region,
      options: def.options != null ? cloneLayoutJson(def.options) : undefined,
    };
    items.push(addition);
    present.add(def.pluginId);
  }
  if (items.length === v2.items.length) return v2;
  return { version: 2, items };
}

function withoutLegacyTiles(layout: DashboardLayout): DashboardLayoutV2 {
  const v2 = ensureLayoutV2(layout);
  const items: RootLayoutItem[] = [];
  for (const it of v2.items) {
    if (it.kind === "group") {
      const children = it.children.filter((c) => !LEGACY_PLUGIN_IDS.has(c.pluginId));
      if (children.length === 0) continue;
      items.push({ ...it, children });
    } else {
      if (LEGACY_PLUGIN_IDS.has(it.pluginId)) continue;
      items.push(it);
    }
  }
  return { version: 2, items };
}

function countAllTiles(l: DashboardLayoutV2): number {
  return [...iterateTilesInLayout(l.items)].length;
}

export function initialDashboardLayout(): DashboardLayoutV2 {
  try {
    const stored = loadDashboardLayout();
    if (stored == null) {
      return layoutWithGrid(cloneLayoutJson(DEFAULT_DASHBOARD_LAYOUT));
    }
    const v2raw = ensureLayoutV2(stored);
    const base = withoutLegacyTiles(stored);
    const strippedAny = countAllTiles(v2raw) !== countAllTiles(base);
    const merged = mergeMissingDefaultPlugins(base);
    const mergedGrew = countAllTiles(merged) > countAllTiles(base);
    const next = mergedGrew ? merged : base;
    if (mergedGrew || strippedAny) {
      const packed = layoutWithGrid(next);
      saveDashboardLayout(packed);
      return packed;
    }
    return layoutWithGrid(next);
  } catch (e) {
    console.error("Failed to apply saved dashboard layout; resetting to default.", e);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    return layoutWithGrid(cloneLayoutJson(DEFAULT_DASHBOARD_LAYOUT));
  }
}
