/**
 * First paint layout: localStorage cache, v1→v2 migration (via `ensureLayoutV2`), optional
 * default-tile merge, legacy tile strip, then `layoutWithGrid` pack.
 *
 * **Dirty vs server baseline:** until a successful server GET applies via `acceptServerLayout`,
 * the UI may show cache-only layout (`layoutSource === "cache"`). After server layout applies,
 * localStorage is overwritten with that document; subsequent edits are dirty vs that snapshot
 * until the debounced PUT succeeds (see `layoutStore` / Phase 8 for undo interaction).
 */
import { DEFAULT_DASHBOARD_LAYOUT } from "../defaultLayout";
import { cloneLayoutJson, layoutWithGrid } from "../gridPlacement";
import { iterateTilesInLayout } from "../layoutTree";
import {
  clearLayoutLocalPersistGate,
  DASHBOARD_LAYOUT_STORAGE_KEY,
  loadDashboardLayout,
  saveDashboardLayout,
} from "../layoutStorage";
import { stripLegacyPerfSummaryTiles } from "../migrations/stripLegacyPerfSummary";
import { ensureLayoutV2 } from "../migration";
import type { DashboardLayout, DashboardLayoutV2, DashboardTile, RootTileItem } from "../types";

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
    const base = stripLegacyPerfSummaryTiles(stored);
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
    clearLayoutLocalPersistGate();
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(DASHBOARD_LAYOUT_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    return layoutWithGrid(cloneLayoutJson(DEFAULT_DASHBOARD_LAYOUT));
  }
}
