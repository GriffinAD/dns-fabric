/**
 * First paint layout: localStorage cache, v1→v2→v3 migration, optional default-tile merge, legacy tile
 * strip, then `layoutWithGrid` pack.
 *
 * **Dirty vs server baseline:** until a successful server GET applies via `acceptServerLayout`,
 * the UI may show cache-only layout (`layoutSource === "cache"`). After server layout applies,
 * localStorage is overwritten with that document; subsequent edits are dirty vs that snapshot
 * until the debounced PUT succeeds (see `layoutStore` / Phase 8 for undo interaction).
 */
import { DEFAULT_DASHBOARD_LAYOUT } from "../layout/defaultLayout";
import * as gridPlacement from "../grid/gridPlacement";
import { iterateTilesInLayout } from "../layout/layoutTree";
import { ensureLayoutV3 } from "../migration";
import {
  clearLayoutLocalPersistGate,
  DASHBOARD_LAYOUT_STORAGE_KEY,
  loadDashboardLayout,
  saveDashboardLayout,
} from "../layout/layoutStorage";
import { stripLegacyPerfSummaryTiles } from "../migrations/stripLegacyPerfSummary";
import type { DashboardLayout, DashboardLayoutV3, DashboardTile, RootTileItem } from "../types";

function newMergedTileId(pluginId: string): string {
  const slug = pluginId.replace(/[^a-z0-9]+/gi, "-");
  return `tile-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Default tile rows (all plugins) for merge — inner + root. */
const DEFAULT_TILES: DashboardTile[] = [...iterateTilesInLayout(DEFAULT_DASHBOARD_LAYOUT.items)];

/** Add missing plugins from the built-in default (new tiles after upgrade). */
export function mergeMissingDefaultPlugins(layout: DashboardLayout): DashboardLayoutV3 {
  const v3 = ensureLayoutV3(layout);
  const present = new Set([...iterateTilesInLayout(v3.items)].map((t) => t.pluginId));
  const items = [...v3.items];
  for (const def of DEFAULT_TILES) {
    if (present.has(def.pluginId)) continue;
    const addition: RootTileItem = {
      kind: "tile",
      id: newMergedTileId(def.pluginId),
      pluginId: def.pluginId,
      hostControl: def.hostControl,
      displayMode: def.displayMode,
      region: def.region,
      options: def.options != null ? gridPlacement.cloneLayoutJson(def.options) : undefined,
    };
    items.push(addition);
    present.add(def.pluginId);
  }
  if (items.length === v3.items.length) return v3;
  return { version: 3, items };
}

function countAllTiles(l: { items: Parameters<typeof iterateTilesInLayout>[0] }): number {
  return [...iterateTilesInLayout(l.items)].length;
}

export function initialDashboardLayout(): DashboardLayoutV3 {
  try {
    const stored = loadDashboardLayout();
    if (stored == null) {
      return gridPlacement.layoutWithGrid(gridPlacement.cloneLayoutJson(DEFAULT_DASHBOARD_LAYOUT));
    }
    const beforeStrip = ensureLayoutV3(stored);
    const base = stripLegacyPerfSummaryTiles(beforeStrip);
    const strippedAny = countAllTiles(beforeStrip) !== countAllTiles(base);
    const merged = mergeMissingDefaultPlugins(base);
    const mergedGrew = countAllTiles(merged) > countAllTiles(base);
    const next = mergedGrew ? merged : base;
    if (mergedGrew || strippedAny) {
      const packed = gridPlacement.layoutWithGrid(next);
      saveDashboardLayout(packed);
      return packed;
    }
    return gridPlacement.layoutWithGrid(next);
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
    return gridPlacement.layoutWithGrid(gridPlacement.cloneLayoutJson(DEFAULT_DASHBOARD_LAYOUT));
  }
}
