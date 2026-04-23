import type { DashboardLayout } from "./types";

/** Initial layout for dev until persistence lands. */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 1,
  tiles: [
    {
      id: "tile-perf-cpu",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "compact",
      region: "status-zone",
      grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      options: {
        cpu_total: false,
        display_style: "gauge",
      },
    },
    {
      id: "tile-perf-ram",
      pluginId: "perf.ram",
      hostControl: "single-panel",
      displayMode: "compact",
      region: "status-zone",
      grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      options: {
        display_style: "gauge",
      },
    },
    {
      id: "tile-perf-net",
      pluginId: "perf.network",
      hostControl: "single-panel",
      displayMode: "compact",
      region: "status-zone",
      grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      options: {
        network_by_adapter: true,
        display_style: "gauge",
      },
    },
    {
      id: "tile-perf-disk",
      pluginId: "perf.disk",
      hostControl: "single-panel",
      displayMode: "compact",
      region: "status-zone",
      grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      options: {
        disk_by_volume: true,
        display_style: "gauge",
      },
    },
    {
      id: "tile-pools",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
      grid: { col: 3, row: 1, colSpan: 3, rowSpan: 1 },
    },
    {
      id: "tile-discovery",
      pluginId: "discovery.records",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
      grid: { col: 6, row: 1, colSpan: 3, rowSpan: 1 },
    },
    {
      id: "tile-clients",
      pluginId: "dhcp.clients",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
      grid: { col: 9, row: 1, colSpan: 3, rowSpan: 1 },
    },
    {
      id: "tile-reservations",
      pluginId: "dhcp.reservations",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
      grid: { col: 0, row: 2, colSpan: 12, rowSpan: 1 },
    },
  ],
};
