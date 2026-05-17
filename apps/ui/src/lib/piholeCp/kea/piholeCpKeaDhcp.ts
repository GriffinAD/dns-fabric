import type { DashboardResponse } from "../layout/dashboardZod";
import type { PiholeCpMeta } from "../gateway/PiholeCpGateway";

const PIHOLE_CP_DHCP_TILE_PLUGIN_IDS = new Set([
  "dhcp.pools",
  "dhcp.clients",
  "dhcp.reservations",
]);

const PIHOLE_CP_KEA_FABRIC_OPERATOR_TILE_PLUGIN_IDS = new Set([
  "discovery.records",
  "perf.summary",
]);

/** Kea Fabric operator plugin ids for DHCP tables (pools, leases, reservations). */
export function isPiholeCpDhcpTilePluginId(pluginId: string): boolean {
  return PIHOLE_CP_DHCP_TILE_PLUGIN_IDS.has(pluginId);
}

/** Discovery + aggregate Fabric perf — only meaningful when this stack uses Kea DHCP + Fabric operator. */
export function isPiholeCpKeaFabricOperatorTilePluginId(pluginId: string): boolean {
  return PIHOLE_CP_KEA_FABRIC_OPERATOR_TILE_PLUGIN_IDS.has(pluginId);
}

/**
 * Pi-hole HA stack uses `DHCP_MODE=kea` when Kea DHCP is active; same value is in
 * `GET /dashboard` `sections.ha.dhcp_mode` and `GET /v1/meta` `dhcp_mode`.
 */
export function isKeaDhcpTilesEnabled(
  meta: PiholeCpMeta | null,
  dashboard: DashboardResponse | null,
): boolean {
  const fromMeta = meta?.dhcp_mode?.trim().toLowerCase();
  if (fromMeta === "kea") return true;
  if (fromMeta) return false;
  if (!dashboard) return false;
  const ha = dashboard.sections["ha"];
  if (!ha || typeof ha !== "object") return false;
  const mode = (ha as Record<string, unknown>)["dhcp_mode"];
  return typeof mode === "string" && mode.trim().toLowerCase() === "kea";
}
