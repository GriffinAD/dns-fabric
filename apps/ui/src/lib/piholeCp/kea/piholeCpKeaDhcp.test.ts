import { describe, expect, it } from "vitest";

import { dashboardResponseSchema } from "../layout/dashboardZod";
import { isKeaDhcpTilesEnabled, isPiholeCpKeaFabricOperatorTilePluginId } from "../kea/piholeCpKeaDhcp";

describe("piholeCpKeaDhcp", () => {
  it("isKeaDhcpTilesEnabled is true when meta.dhcp_mode is kea", () => {
    expect(
      isKeaDhcpTilesEnabled(
        { dhcp_mode: "kea", node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null },
        null,
      ),
    ).toBe(true);
  });

  it("isKeaDhcpTilesEnabled is false when meta.dhcp_mode is set but not kea", () => {
    expect(
      isKeaDhcpTilesEnabled(
        { dhcp_mode: "none", node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null },
        dashboardResponseSchema.parse({
          node: "n",
          version: "1",
          widgets: [],
          sections: { ha: { dhcp_mode: "kea" } },
        }),
      ),
    ).toBe(false);
  });

  it("isKeaDhcpTilesEnabled is false when meta and dashboard are absent", () => {
    expect(isKeaDhcpTilesEnabled(null, null)).toBe(false);
  });

  it("isKeaDhcpTilesEnabled falls back to dashboard sections.ha when meta omits dhcp_mode", () => {
    const dash = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [],
      sections: { ha: { dhcp_mode: "kea" } },
    });
    expect(
      isKeaDhcpTilesEnabled(
        { dhcp_mode: null, node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null },
        dash,
      ),
    ).toBe(true);
    expect(isKeaDhcpTilesEnabled(null, dash)).toBe(true);
  });

  it("isPiholeCpKeaFabricOperatorTilePluginId matches discovery and fabric summary", () => {
    expect(isPiholeCpKeaFabricOperatorTilePluginId("discovery.records")).toBe(true);
    expect(isPiholeCpKeaFabricOperatorTilePluginId("perf.summary")).toBe(true);
    expect(isPiholeCpKeaFabricOperatorTilePluginId("perf.cpu")).toBe(false);
  });
});
