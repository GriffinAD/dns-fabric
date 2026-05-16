import type { DashboardResponse } from "./dashboardZod";
import type { PiholeCpMeta } from "./PiholeCpGateway";
import { isKeaDhcpTilesEnabled } from "./piholeCpKeaDhcp";

const KEA_WIDGET_SECTIONS = new Set(["kea_dhcp", "peer_telemetry", "peer_dhcp"]);

/** `/dashboard` widgets should match `GET /v1/meta` dhcp_mode after a stack restart. */
export function isDashboardMetaCoherent(
  meta: PiholeCpMeta,
  dashboard: DashboardResponse,
): boolean {
  const kea = isKeaDhcpTilesEnabled(meta, dashboard);
  const hasKeaWidget = dashboard.widgets.some((w) => KEA_WIDGET_SECTIONS.has(w.section));
  if (!kea && hasKeaWidget) return false;
  return true;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
