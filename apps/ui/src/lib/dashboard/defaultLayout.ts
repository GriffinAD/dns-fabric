import type { DashboardLayout } from "./types";

/** Initial layout for dev until persistence lands. */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 1,
  tiles: [
    {
      id: "tile-perf",
      pluginId: "perf.summary",
      hostControl: "single-panel",
      displayMode: "compact",
      region: "status-zone",
      options: {
        cpu_total: true,
        network_by_adapter: false,
        disk_by_volume: false,
        display_style: "gauge",
      },
    },
    {
      id: "tile-pools",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
    },
    {
      id: "tile-discovery",
      pluginId: "discovery.records",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
    },
  ],
};
