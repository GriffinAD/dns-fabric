import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import { layoutWithGrid } from "./gridPlacement";
import type { DashboardLayout, DashboardTile } from "./types";

const STORAGE_KEY = "kea-fabric-dashboard-layout";

/** Removed from layouts on load (replaced by split perf.* tiles; old localStorage still had this). */
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
  if (o.display_style !== undefined && o.display_style !== "gauge" && o.display_style !== "percent_only") return false;
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
  if (t.grid !== undefined && t.grid !== null && !validGridCell(t.grid)) return false;
  if (!isTileOptions(t.options)) return false;
  return true;
}

export function parseDashboardLayout(value: unknown): DashboardLayout | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.version !== "number" || v.version < 1) return null;
  if (!Array.isArray(v.tiles)) return null;
  const tiles: DashboardTile[] = [];
  for (const item of v.tiles) {
    if (!isTile(item)) return null;
    tiles.push(item);
  }
  return { version: v.version, tiles };
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

/** Append any default-layout plugins missing from a saved layout (e.g. after new tiles ship). */
export function mergeMissingDefaultPlugins(layout: DashboardLayout): DashboardLayout {
  const present = new Set(layout.tiles.map((t) => t.pluginId));
  const additions: DashboardTile[] = [];
  for (const def of DEFAULT_DASHBOARD_LAYOUT.tiles) {
    if (!present.has(def.pluginId)) {
      additions.push({
        ...structuredClone(def),
        id: newMergedTileId(def.pluginId),
      });
    }
  }
  if (additions.length === 0) return layout;
  return { ...layout, tiles: [...layout.tiles, ...additions] };
}

function withoutLegacyTiles(layout: DashboardLayout): DashboardLayout {
  return {
    ...layout,
    tiles: layout.tiles.filter((t) => !LEGACY_PLUGIN_IDS.has(t.pluginId)),
  };
}

export function initialDashboardLayout(): DashboardLayout {
  try {
    const stored = loadDashboardLayout();
    let base: DashboardLayout =
      stored != null ? withoutLegacyTiles(stored) : structuredClone(DEFAULT_DASHBOARD_LAYOUT);
    const strippedAny =
      stored != null && base.tiles.length !== stored.tiles.length;

    if (stored != null) {
      const merged = mergeMissingDefaultPlugins(base);
      const mergedGrew = merged.tiles.length > base.tiles.length;
      base = mergedGrew ? merged : base;
      if (mergedGrew || strippedAny) {
        saveDashboardLayout(base);
      }
    }

    return layoutWithGrid(base);
  } catch (e) {
    console.error("Failed to apply saved dashboard layout; resetting to default.", e);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    return layoutWithGrid(structuredClone(DEFAULT_DASHBOARD_LAYOUT));
  }
}
