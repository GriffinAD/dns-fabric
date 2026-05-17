import type { PluginEntry } from "../../api/types";

import { buildPiholeCpPluginPalette } from "../layout/buildLayoutFromDashboard";
import type { DashboardResponse } from "../layout/dashboardZod";
import type { PiholeCpMeta } from "../gateway/PiholeCpGateway";
import {
  isKeaDhcpTilesEnabled,
  isPiholeCpDhcpTilePluginId,
  isPiholeCpKeaFabricOperatorTilePluginId,
} from "../kea/piholeCpKeaDhcp";

/**
 * Built-in Kea Fabric operator tiles (palette + defaults) when `/api/v1/plugins` is empty or fails.
 * Labels match the main operator palette.
 */
export const KEA_OPERATOR_BASELINE_PLUGINS: PluginEntry[] = [
  { id: "dhcp.pools", name: "DHCP pools", enabled: true },
  { id: "dhcp.clients", name: "DHCP clients", enabled: true },
  { id: "dhcp.reservations", name: "Static reservations", enabled: true },
  { id: "discovery.records", name: "Discovery", enabled: true },
  { id: "perf.summary", name: "Fabric summary", enabled: true },
  { id: "perf.cpu", name: "CPU", enabled: true },
  { id: "perf.ram", name: "Memory", enabled: true },
  { id: "perf.network", name: "Network", enabled: true },
  { id: "perf.disk", name: "Disk", enabled: true },
];

/**
 * Palette for the Pi-hole CP bundle: Kea baseline (or API list) plus dynamic `pihole_ha.*` section plugins.
 */
export function mergeOperatorPluginsForPiholeCp(
  apiItems: PluginEntry[] | null | undefined,
  dashboard: DashboardResponse | null,
  meta: PiholeCpMeta | null = null,
): PluginEntry[] {
  const keaDhcpTiles = isKeaDhcpTilesEnabled(meta, dashboard);
  const byId = new Map<string, PluginEntry>();
  for (const p of KEA_OPERATOR_BASELINE_PLUGINS) {
    if (!keaDhcpTiles && (isPiholeCpDhcpTilePluginId(p.id) || isPiholeCpKeaFabricOperatorTilePluginId(p.id)))
      continue;
    byId.set(p.id, { ...p });
  }
  if (apiItems && apiItems.length > 0) {
    for (const p of apiItems) {
      if (!keaDhcpTiles && (isPiholeCpDhcpTilePluginId(p.id) || isPiholeCpKeaFabricOperatorTilePluginId(p.id)))
        continue;
      byId.set(p.id, { ...p });
    }
  }
  if (dashboard) {
    for (const p of buildPiholeCpPluginPalette(dashboard, meta)) {
      byId.set(p.id, { ...p });
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
