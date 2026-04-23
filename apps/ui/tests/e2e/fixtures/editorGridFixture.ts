import type { Page } from "@playwright/test";

import type { DashboardLayout } from "../../../src/lib/dashboard/types";

/**
 * Non-overlapping 12-col layout used by dashboard grid e2e. Matches how we expect the first row
 * to pack (4+2+2+2) and a full-width DHCP pools row, so localStorage is never ambiguous vs dev.
 */
export const E2E_EDITOR_12COL_LAYOUT: DashboardLayout = {
  version: 1,
  tiles: [
    {
      id: "tile-perf-cpu",
      pluginId: "perf.cpu",
      hostControl: "single-panel",
      displayMode: "full",
      region: "status-zone",
      grid: { col: 0, row: 0, colSpan: 4, rowSpan: 1 },
      rowPanel: "status",
      options: { cpu_total: false, display_style: "gauge" },
    },
    {
      id: "tile-perf-ram",
      pluginId: "perf.ram",
      hostControl: "single-panel",
      displayMode: "full",
      region: "status-zone",
      grid: { col: 4, row: 0, colSpan: 2, rowSpan: 1 },
      rowPanel: "status",
      options: { display_style: "gauge" },
    },
    {
      id: "tile-perf-net",
      pluginId: "perf.network",
      hostControl: "single-panel",
      displayMode: "compact",
      region: "status-zone",
      grid: { col: 6, row: 0, colSpan: 2, rowSpan: 1 },
      rowPanel: "status",
      options: { network_by_adapter: true, display_style: "gauge" },
    },
    {
      id: "tile-perf-disk",
      pluginId: "perf.disk",
      hostControl: "single-panel",
      displayMode: "compact",
      region: "status-zone",
      grid: { col: 8, row: 0, colSpan: 2, rowSpan: 1 },
      rowPanel: "status",
      options: { disk_by_volume: true, display_style: "gauge" },
    },
    {
      id: "tile-pools",
      pluginId: "dhcp.pools",
      hostControl: "single-panel",
      displayMode: "compact",
      region: "primary-grid",
      grid: { col: 0, row: 1, colSpan: 12, rowSpan: 1 },
    },
    {
      id: "tile-discovery",
      pluginId: "discovery.records",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
      grid: { col: 0, row: 2, colSpan: 6, rowSpan: 2 },
    },
    {
      id: "tile-clients",
      pluginId: "dhcp.clients",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
      grid: { col: 0, row: 4, colSpan: 12, rowSpan: 2 },
    },
    {
      id: "tile-reservations",
      pluginId: "dhcp.reservations",
      hostControl: "single-panel",
      displayMode: "full",
      region: "primary-grid",
      grid: { col: 0, row: 6, colSpan: 12, rowSpan: 1 },
    },
  ],
};

/** Call in `test.beforeEach` so `page.goto` runs after the script (deterministic layout, no dev localStorage). */
export async function seedEditorLayoutInLocalStorageBeforeNavigation(page: Page): Promise<void> {
  const key = "kea-fabric-dashboard-layout";
  const value = JSON.stringify(E2E_EDITOR_12COL_LAYOUT);
  await page.addInitScript(
    (args: { key: string; value: string }) => {
      localStorage.setItem(args.key, args.value);
    },
    { key, value },
  );
}
