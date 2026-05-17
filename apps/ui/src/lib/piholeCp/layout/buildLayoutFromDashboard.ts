import type { PluginEntry, UiDashboardManifest } from "../../api/types";
import { DEFAULT_DASHBOARD_LAYOUT } from "../../dashboard/layout/defaultLayout";
import { cloneLayoutJson, layoutWithGrid } from "../../dashboard/grid/gridPlacement";
import { ensureLayoutV3 } from "../../dashboard/migration";
import {
  isDashboardGroupNode,
  type DashboardGroup,
  type DashboardLayout,
  type DashboardLayoutV3,
  type GroupChild,
  type RootLayoutItem,
  type RootTileItem,
} from "../../dashboard/types";
import type { DashboardResponse } from "../layout/dashboardZod";
import { isKeaDhcpTilesEnabled, isPiholeCpDhcpTilePluginId, isPiholeCpKeaFabricOperatorTilePluginId } from "../kea/piholeCpKeaDhcp";
import type { PiholeCpMeta } from "../gateway/PiholeCpGateway";
import {
  humanizePiholeCpSectionKey,
  PIHOLE_HA_SECTION_PLUGIN_ID,
  pluginIdForPiholeDashboardSection,
  isPiholeHaPerSectionPluginId,
} from "../plugins/piholeHaPluginIds";

type DashboardWidget = DashboardResponse["widgets"][number];

/** Section-backed tiles that only belong in the UI when Kea DHCP mode is active (see control-plane `WIDGETS`). */
function isPiholeCpKeaModeSectionPluginId(pluginId: string): boolean {
  return (
    pluginId === pluginIdForPiholeDashboardSection("kea_dhcp") ||
    pluginId === pluginIdForPiholeDashboardSection("peer_telemetry") ||
    pluginId === pluginIdForPiholeDashboardSection("peer_dhcp")
  );
}

/** Tiles to remove from layout/palette when `DHCP_MODE` ≠ `kea` (Kea DHCP + Fabric operator path). */
function tileHiddenWhenKeaDhcpDisabled(tile: { pluginId: string; options?: unknown }): boolean {
  if (isPiholeCpDhcpTilePluginId(tile.pluginId)) return true;
  if (isPiholeCpKeaFabricOperatorTilePluginId(tile.pluginId)) return true;
  if (isPiholeCpKeaModeSectionPluginId(tile.pluginId)) return true;
  const sec = (tile.options as { section?: unknown } | undefined)?.section;
  return (
    tile.pluginId === PIHOLE_HA_SECTION_PLUGIN_ID &&
    typeof sec === "string" &&
    (sec === "kea_dhcp" || sec === "peer_telemetry" || sec === "peer_dhcp")
  );
}

/** Widget rows from `/dashboard` that should not become tiles when Kea DHCP is off. */
function dashboardWidgetsForPiholeCpLayout(
  dashboard: DashboardResponse,
  meta: PiholeCpMeta | null,
): DashboardWidget[] {
  const keaDhcp = isKeaDhcpTilesEnabled(meta, dashboard);
  if (keaDhcp) return dashboard.widgets;
  return dashboard.widgets.filter(
    (w) => w.section !== "kea_dhcp" && w.section !== "peer_telemetry" && w.section !== "peer_dhcp",
  );
}

/** localStorage key for Pi-hole CP dashboard layout (isolated from Kea Fabric `kea-fabric-dashboard-layout`). */
export const PIHOLE_CP_LAYOUT_STORAGE_KEY = "pihole-cp-dashboard-layout-v4";

export { PIHOLE_HA_SECTION_PLUGIN_ID };

/** Pi-hole section tiles render as full panels; compact is not offered in tile settings. */
export const PIHOLE_CP_SECTION_TILE_UI: UiDashboardManifest = {
  allowed_host_controls: ["single-panel"],
  default_size_hint: "medium",
  min_size: null,
  max_size: null,
  compact_min_footprint: null,
  supports_compact: false,
  supports_full: true,
};

export function buildPiholeCpPluginPalette(
  dashboard: DashboardResponse,
  meta: PiholeCpMeta | null = null,
): PluginEntry[] {
  const keys = new Set<string>();
  for (const k of Object.keys(dashboard.sections)) keys.add(k);
  for (const w of dashboard.widgets) keys.add(w.section);
  if (!isKeaDhcpTilesEnabled(meta, dashboard)) {
    keys.delete("kea_dhcp");
    keys.delete("peer_telemetry");
    keys.delete("peer_dhcp");
  }
  return [...keys].sort().map((section) => ({
    id: pluginIdForPiholeDashboardSection(section),
    name: humanizePiholeCpSectionKey(section),
    enabled: true,
    ui_dashboard: PIHOLE_CP_SECTION_TILE_UI,
  }));
}

export function collectPiholeSectionWidgetIds(items: RootLayoutItem[]): Set<string> {
  const ids = new Set<string>();
  function walk(list: RootLayoutItem[]) {
    for (const it of list) {
      if (it.kind === "tile") {
        const o = it.options as { widgetId?: unknown } | undefined;
        if (
          typeof o?.widgetId === "string" &&
          (it.pluginId === PIHOLE_HA_SECTION_PLUGIN_ID || isPiholeHaPerSectionPluginId(it.pluginId))
        ) {
          ids.add(o.widgetId);
        }
      }
      if (it.kind === "group") walk(it.children);
    }
  }
  walk(items);
  return ids;
}

function rootTileFromWidget(w: DashboardWidget): RootTileItem {
  const opts: Record<string, string> = {
    section: w.section,
    title: w.title,
    widgetId: w.id,
  };
  if (w.view != null && w.view !== "") opts.view = w.view;
  return {
    kind: "tile" as const,
    id: `tile-pihole-${w.id}`,
    pluginId: pluginIdForPiholeDashboardSection(w.section),
    hostControl: "single-panel" as const,
    displayMode: "full" as const,
    options: opts,
  };
}

export function buildDefaultLayoutFromDashboard(dashboard: DashboardResponse): DashboardLayoutV3 {
  const items: RootLayoutItem[] = dashboard.widgets.map((w: DashboardWidget) => rootTileFromWidget(w));
  return layoutWithGrid({ version: 3, items });
}

/** Kea Fabric default dashboard (perf status row + DHCP/discovery) plus one tile per Pi-hole `/dashboard` widget. */
function stripPiholeCpDhcpTilesFromGroupChildren(children: GroupChild[]): GroupChild[] {
  const out: GroupChild[] = [];
  for (const ch of children) {
    if (isDashboardGroupNode(ch)) {
      out.push({ ...ch, children: stripPiholeCpDhcpTilesFromGroupChildren(ch.children) });
      continue;
    }
    if (tileHiddenWhenKeaDhcpDisabled(ch)) continue;
    out.push(ch);
  }
  return out;
}

/** Removes Kea DHCP / Fabric-only operator tiles and `kea_dhcp` section tiles when Kea DHCP is not active. */
export function stripPiholeCpDhcpTilesFromLayoutItems(items: RootLayoutItem[]): RootLayoutItem[] {
  const out: RootLayoutItem[] = [];
  for (const it of items) {
    if (it.kind === "tile") {
      if (tileHiddenWhenKeaDhcpDisabled(it)) continue;
      out.push(it);
      continue;
    }
    const g = it as DashboardGroup;
    out.push({ ...g, children: stripPiholeCpDhcpTilesFromGroupChildren(g.children) });
  }
  return out;
}

/** True when Kea DHCP is off but the layout still has tiles that must be hidden (stale localStorage, editor, or mode changed after load). */
export function layoutContainsPiholeCpKeaDisabledTiles(
  layout: DashboardLayoutV3,
  meta: PiholeCpMeta | null,
  dashboard: DashboardResponse,
): boolean {
  if (isKeaDhcpTilesEnabled(meta, dashboard)) return false;
  function walk(items: RootLayoutItem[]): boolean {
    for (const it of items) {
      if (it.kind === "tile" && tileHiddenWhenKeaDhcpDisabled(it)) return true;
      if (it.kind === "group") {
        const g = it as DashboardGroup;
        if (walk(g.children)) return true;
      }
    }
    return false;
  }
  return walk(layout.items);
}

/** Strip forbidden tiles and reflow the grid when Kea DHCP is not active; otherwise returns `layout` unchanged. */
export function stripPiholeCpLayoutWhenKeaDhcpDisabled(
  layout: DashboardLayoutV3,
  meta: PiholeCpMeta | null,
  dashboard: DashboardResponse,
): DashboardLayoutV3 {
  if (isKeaDhcpTilesEnabled(meta, dashboard)) return layout;
  return layoutWithGrid({
    version: 3,
    items: stripPiholeCpDhcpTilesFromLayoutItems(layout.items),
  });
}

export function buildPiholeCpDefaultLayout(
  dashboard: DashboardResponse,
  meta: PiholeCpMeta | null = null,
): DashboardLayoutV3 {
  const base = cloneLayoutJson(DEFAULT_DASHBOARD_LAYOUT);
  const keaDhcp = isKeaDhcpTilesEnabled(meta, dashboard);
  const baseItems = keaDhcp ? base.items : stripPiholeCpDhcpTilesFromLayoutItems(base.items);
  const piholeTiles = dashboardWidgetsForPiholeCpLayout(dashboard, meta).map((w: DashboardWidget) =>
    rootTileFromWidget(w),
  );
  return layoutWithGrid({ version: 3, items: [...baseItems, ...piholeTiles] });
}

/**
 * Appends layout tiles for server widgets that are not yet represented in the layout.
 * Returns null when nothing was added (idempotent for `$effect` / pick-initial merge).
 */
export function mergeNewServerWidgetsIntoLayout(
  layout: DashboardLayoutV3,
  dashboard: DashboardResponse,
  meta: PiholeCpMeta | null = null,
): DashboardLayoutV3 | null {
  const found = collectPiholeSectionWidgetIds(layout.items);
  const widgets = dashboardWidgetsForPiholeCpLayout(dashboard, meta);
  const missing = widgets.filter((w) => !found.has(w.id));
  if (missing.length === 0) return null;
  const newTiles: RootLayoutItem[] = missing.map((w) => rootTileFromWidget(w));
  return layoutWithGrid({ version: 3, items: [...layout.items, ...newTiles] });
}

export function pickInitialPiholeCpLayout(
  dashboard: DashboardResponse,
  stored: DashboardLayout | null,
  meta: PiholeCpMeta | null = null,
): DashboardLayoutV3 {
  const widgets = dashboardWidgetsForPiholeCpLayout(dashboard, meta);
  const expected = new Set(widgets.map((w) => w.id));
  if (!stored || stored.version !== 3) {
    return buildPiholeCpDefaultLayout(dashboard, meta);
  }
  let base = ensureLayoutV3(stored);
  if (!isKeaDhcpTilesEnabled(meta, dashboard)) {
    base = layoutWithGrid({
      version: 3,
      items: stripPiholeCpDhcpTilesFromLayoutItems(base.items),
    });
  }
  const found = collectPiholeSectionWidgetIds(base.items);
  if ([...expected].every((id) => found.has(id))) {
    return base;
  }
  return mergeNewServerWidgetsIntoLayout(base, dashboard, meta)!;
}
