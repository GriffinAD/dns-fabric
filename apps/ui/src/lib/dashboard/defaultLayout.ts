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
    },
    {
      id: "tile-pools",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
    },
  ],
};
