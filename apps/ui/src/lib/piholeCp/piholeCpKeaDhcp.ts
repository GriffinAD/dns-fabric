import type { DashboardResponse } from "./dashboardZod";
import type { PiholeCpMeta } from "./PiholeCpGateway";

/** Kea Fabric operator plugin ids for DHCP tables (pools, leases, reservations). */
export function isPiholeCpDhcpTilePluginId(pluginId: string): boolean {
  return (
    pluginId === "dhcp.pools" || pluginId === "dhcp.clients" || pluginId === "dhcp.reservations"
  );
}

/** Discovery + aggregate Fabric perf — only meaningful when this stack uses Kea DHCP + Fabric operator. */
export function isPiholeCpKeaFabricOperatorTilePluginId(pluginId: string): boolean {
  return pluginId === "discovery.records" || pluginId === "perf.summary";
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
