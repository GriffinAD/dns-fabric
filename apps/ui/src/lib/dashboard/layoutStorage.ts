import { DEFAULT_DASHBOARD_LAYOUT } from "./defaultLayout";
import type { DashboardLayout, DashboardTile } from "./types";

const STORAGE_KEY = "kea-fabric-dashboard-layout";

const HOST_CONTROLS = new Set(["single-panel", "tab-control", "vertical-stack", "split-grid"]);
const DISPLAY_MODES = new Set(["compact", "full"]);

function isTileOptions(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (o.cpu_total !== undefined && typeof o.cpu_total !== "boolean") return false;
  if (o.network_by_adapter !== undefined && typeof o.network_by_adapter !== "boolean") return false;
  if (o.disk_by_volume !== undefined && typeof o.disk_by_volume !== "boolean") return false;
  if (o.display_style !== undefined && o.display_style !== "gauge" && o.display_style !== "percent_only") return false;
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

export function initialDashboardLayout(): DashboardLayout {
  return loadDashboardLayout() ?? structuredClone(DEFAULT_DASHBOARD_LAYOUT);
}
