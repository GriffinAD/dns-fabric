import { describe, expect, it } from "vitest";

import { dashboardResponseSchema } from "../layout/dashboardZod";
import { KEA_OPERATOR_BASELINE_PLUGINS, mergeOperatorPluginsForPiholeCp } from "../plugins/operatorBaselinePlugins";

describe("operatorBaselinePlugins", () => {
  it("mergeOperatorPluginsForPiholeCp falls back to baseline when API is empty", () => {
    const dash = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [{ id: "w1", title: "HA", section: "ha" }],
      sections: { ha: { dhcp_mode: "kea" } },
    });
    const merged = mergeOperatorPluginsForPiholeCp([], dash);
    const ids = merged.map((p) => p.id).sort();
    expect(ids).toContain("perf.cpu");
    expect(ids).toContain("dhcp.pools");
    expect(ids).toContain("pihole_ha.ha");
  });

  it("mergeOperatorPluginsForPiholeCp hides DHCP plugins when Kea DHCP is not enabled", () => {
    const dash = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [{ id: "w1", title: "HA", section: "ha" }],
      sections: { ha: { dhcp_mode: "none" } },
    });
    const merged = mergeOperatorPluginsForPiholeCp(
      [
        { id: "dhcp.pools", name: "Pools", enabled: true },
        { id: "perf.cpu", name: "CPU", enabled: true },
      ],
      dash,
      { dhcp_mode: "none", node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null },
    );
    const ids = merged.map((p) => p.id).sort();
    expect(ids).not.toContain("dhcp.pools");
    expect(ids).not.toContain("discovery.records");
    expect(ids).not.toContain("perf.summary");
    expect(ids).toContain("perf.cpu");
  });

  it("mergeOperatorPluginsForPiholeCp prefers API entries over baseline ids", () => {
    const dash = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [],
      sections: {},
    });
    const merged = mergeOperatorPluginsForPiholeCp(
      [{ id: "perf.cpu", name: "CPU override", enabled: true }],
      dash,
      null,
    );
    expect(merged.find((p) => p.id === "perf.cpu")?.name).toBe("CPU override");
  });

  it("mergeOperatorPluginsForPiholeCp omits Kea-only section palette entries when Kea DHCP is off", () => {
    const dash = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [],
      sections: {
        ha: { ok: true, dhcp_mode: "none" },
        kea_dhcp: { ok: false },
        peer_telemetry: { ok: true },
        peer_dhcp: { ok: true },
      },
    });
    const merged = mergeOperatorPluginsForPiholeCp([], dash, {
      dhcp_mode: "none",
      node: "n",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
    });
    const ids = merged.map((p) => p.id);
    expect(ids).not.toContain("pihole_ha.kea_dhcp");
    expect(ids).not.toContain("pihole_ha.peer_telemetry");
    expect(ids).not.toContain("pihole_ha.peer_dhcp");
  });

  it("KEA_OPERATOR_BASELINE_PLUGINS covers default dashboard plugin ids", () => {
    const ids = new Set(KEA_OPERATOR_BASELINE_PLUGINS.map((p) => p.id));
    for (const id of [
      "dhcp.pools",
      "dhcp.clients",
      "dhcp.reservations",
      "discovery.records",
      "perf.summary",
      "perf.cpu",
      "perf.ram",
      "perf.network",
      "perf.disk",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});
