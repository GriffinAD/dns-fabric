import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import { parseDashboardLayoutZod } from "./layoutZod";
import { stripLegacyPerfSummaryTiles } from "./migrations/stripLegacyPerfSummary";
import { ensureLayoutV2, iterateTilesInLayout } from "./layoutTree";
import { cloneLayoutJson, layoutWithGrid } from "./gridPlacement";
import type { DashboardLayout, DashboardLayoutV2, DashboardTile, RootTileItem } from "./types";

const STORAGE_KEY = "kea-fabric-dashboard-layout";

let layoutLocalPersistBlocked = false;
let layoutLocalPersistBlockedReason: string | null = null;

/**
 * Test helper only — do not call from the shipped UI. Sets the same module-level flags as an
 * unsupported stored layout version, so `saveDashboardLayout` warning branches can be asserted.
 */
export function setLocalPersistBlockedStateForTest(blocked: boolean, reason: string | null): void {
  layoutLocalPersistBlocked = blocked;
  layoutLocalPersistBlockedReason = reason;
}

function resetLayoutLocalPersistGate(): void {
  layoutLocalPersistBlocked = false;
  layoutLocalPersistBlockedReason = null;
}

/** True after `loadDashboardLayout` / `initialDashboardLayout` sees layout JSON with version &gt; 2. */
export function isLayoutLocalPersistBlocked(): boolean {
  return layoutLocalPersistBlocked;
}

export function getLayoutLocalPersistBlockedReason(): string | null {
  return layoutLocalPersistBlockedReason;
}

/** Clear gate after trusted server layout, baseline reset, or explicit storage clear. */
export function clearLayoutLocalPersistGate(): void {
  resetLayoutLocalPersistGate();
}

/** Remove stored layout and allow local saves again (e.g. user acknowledges incompatible client). */
export function clearStoredDashboardLayoutAndUnlock(): void {
  resetLayoutLocalPersistGate();
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** When set, stored JSON is newer than this app supports (see `docs/planning/UI_ENGINE_PLAN.md` P3.7). */
export function layoutJsonUnsupportedVersionMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number") return null;
  if (v.version > 2) {
    return `Dashboard layout version ${v.version} is not supported (this app accepts versions 1–2 only).`;
  }
  return null;
}

export function parseDashboardLayout(value: unknown): DashboardLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number" || v.version < 1) return null;
  if (layoutJsonUnsupportedVersionMessage(value) != null) return null;
  return parseDashboardLayoutZod(value);
}

export function loadDashboardLayout(): DashboardLayout | null {
  if (typeof localStorage === "undefined") return null;
  resetLayoutLocalPersistGate();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const unsup = layoutJsonUnsupportedVersionMessage(parsed);
    if (unsup != null) {
      layoutLocalPersistBlocked = true;
      layoutLocalPersistBlockedReason = unsup;
      console.warn(`[layoutStorage] ${unsup} — ignoring stored layout; local layout cache writes disabled until resolved.`);
      return null;
    }
    return parseDashboardLayout(parsed);
  } catch {
    return null;
  }
}

export function saveDashboardLayout(layout: DashboardLayout): void {
  if (typeof localStorage === "undefined") return;
  if (layoutLocalPersistBlocked) {
    console.warn(
      `[layoutStorage] skipped local save (layout cache locked: ${layoutLocalPersistBlockedReason ?? "unknown"})`,
    );
    return;
  }
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
    resetLayoutLocalPersistGate();
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
