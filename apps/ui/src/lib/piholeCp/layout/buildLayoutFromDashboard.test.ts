import { describe, expect, it } from "vitest";

import { isDashboardGroupNode, type DashboardLayoutV3 } from "../../dashboard/types";
import { dashboardResponseSchema } from "../layout/dashboardZod";
import {
  buildDefaultLayoutFromDashboard,
  buildPiholeCpDefaultLayout,
  buildPiholeCpPluginPalette,
  collectPiholeSectionWidgetIds,
  mergeNewServerWidgetsIntoLayout,
  pickInitialPiholeCpLayout,
  PIHOLE_HA_SECTION_PLUGIN_ID,
  layoutContainsPiholeCpKeaDisabledTiles,
  stripPiholeCpLayoutWhenKeaDhcpDisabled,
  stripPiholeCpDhcpTilesFromLayoutItems,
} from "../layout/buildLayoutFromDashboard";
import { pluginIdForPiholeDashboardSection } from "../plugins/piholeHaPluginIds";

describe("buildLayoutFromDashboard", () => {
  const dashboard = dashboardResponseSchema.parse({
    node: "pi1",
    version: "0.4.0",
    widgets: [
      { id: "w1", title: "HA", section: "ha" },
      { id: "w2", title: "DNS", section: "pihole_dns" },
    ],
    sections: {
      ha: { ok: true, dhcp_mode: "kea" },
      pihole_dns: { ok: true },
    },
  });

  it("buildPiholeCpDefaultLayout includes Kea default tiles plus Pi-hole dashboard widgets", () => {
    const layout = buildPiholeCpDefaultLayout(dashboard);
    expect(layout.items.length).toBeGreaterThan(2);
    const rootPluginIds = layout.items.flatMap((it) => {
      if (it.kind === "tile") return [it.pluginId];
      if (it.kind === "group") {
        return it.children.flatMap((c) => ("pluginId" in c ? [c.pluginId] : []));
      }
      return [];
    });
    expect(rootPluginIds).toContain("perf.cpu");
    expect(rootPluginIds).toContain("pihole_ha.ha");
    expect(rootPluginIds).toContain("pihole_ha.pihole_dns");
  });

  it("buildPiholeCpDefaultLayout omits DHCP tiles when Kea DHCP is not enabled", () => {
    const dashNoKea = dashboardResponseSchema.parse({
      node: "pi1",
      version: "0.4.0",
      widgets: [
        { id: "w1", title: "HA", section: "ha" },
        { id: "w2", title: "DNS", section: "pihole_dns" },
      ],
      sections: {
        ha: { ok: true, dhcp_mode: "none" },
        pihole_dns: { ok: true },
      },
    });
    const layout = buildPiholeCpDefaultLayout(dashNoKea, { dhcp_mode: "none", node: "x", peer_ui_base_url: null, kea_fabric_api_base_url: null });
    const rootPluginIds = layout.items.flatMap((it) => {
      if (it.kind === "tile") return [it.pluginId];
      if (it.kind === "group") {
        return it.children.flatMap((c) => ("pluginId" in c ? [c.pluginId] : []));
      }
      return [];
    });
    expect(rootPluginIds).not.toContain("dhcp.pools");
    expect(rootPluginIds).not.toContain("dhcp.clients");
    expect(rootPluginIds).not.toContain("dhcp.reservations");
    expect(rootPluginIds).not.toContain("discovery.records");
    expect(rootPluginIds).not.toContain("perf.summary");
  });

  it("buildPiholeCpDefaultLayout includes DHCP tiles when meta declares dhcp_mode kea", () => {
    const dashNoMode = dashboardResponseSchema.parse({
      node: "pi1",
      version: "0.4.0",
      widgets: [{ id: "w1", title: "HA", section: "ha" }],
      sections: { ha: { ok: true } },
    });
    const layout = buildPiholeCpDefaultLayout(dashNoMode, {
      dhcp_mode: "kea",
      node: "pi1",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
    });
    const rootPluginIds = layout.items.flatMap((it) => (it.kind === "tile" ? [it.pluginId] : []));
    expect(rootPluginIds).toEqual(
      expect.arrayContaining(["dhcp.pools", "dhcp.clients", "dhcp.reservations"]),
    );
  });

  it("stripPiholeCpDhcpTilesFromLayoutItems removes nested DHCP tiles inside groups", () => {
    const items = stripPiholeCpDhcpTilesFromLayoutItems([
      {
        kind: "group",
        id: "g",
        showBorder: true,
        children: [
          {
            kind: "group",
            id: "nested",
            showBorder: true,
            children: [
              {
                id: "inner-dhcp",
                pluginId: "dhcp.pools",
                hostControl: "single-panel",
                displayMode: "full",
              },
            ],
          },
          {
            id: "inner-cpu",
            pluginId: "perf.cpu",
            hostControl: "single-panel",
            displayMode: "compact",
          },
        ],
      },
    ]);
    expect(items).toHaveLength(1);
    const g = items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind !== "group") return;
    expect(g.children).toHaveLength(2);
    const nested = g.children[0];
    expect(isDashboardGroupNode(nested)).toBe(true);
    if (!isDashboardGroupNode(nested)) return;
    expect(nested.children).toHaveLength(0);
    const leaf = g.children[1];
    expect("pluginId" in leaf && leaf.pluginId).toBe("perf.cpu");
  });

  it("stripPiholeCpDhcpTilesFromLayoutItems removes discovery and perf.summary", () => {
    const items = stripPiholeCpDhcpTilesFromLayoutItems([
      {
        kind: "tile" as const,
        id: "d",
        pluginId: "discovery.records",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        kind: "tile" as const,
        id: "s",
        pluginId: "perf.summary",
        hostControl: "single-panel",
        displayMode: "full",
      },
      {
        kind: "tile" as const,
        id: "c",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "compact",
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.kind === "tile" && items[0].pluginId).toBe("perf.cpu");
  });

  it("stripPiholeCpDhcpTilesFromLayoutItems removes legacy pihole_ha.section tile for kea_dhcp", () => {
    const items = stripPiholeCpDhcpTilesFromLayoutItems([
      {
        kind: "tile" as const,
        id: "legacy",
        pluginId: PIHOLE_HA_SECTION_PLUGIN_ID,
        hostControl: "single-panel",
        displayMode: "full",
        options: { section: "kea_dhcp", title: "Kea", widgetId: "w" },
      },
      {
        kind: "tile" as const,
        id: "ha",
        pluginId: PIHOLE_HA_SECTION_PLUGIN_ID,
        hostControl: "single-panel",
        displayMode: "full",
        options: { section: "ha", title: "HA", widgetId: "w1" },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.kind === "tile" && items[0].pluginId).toBe(PIHOLE_HA_SECTION_PLUGIN_ID);
    if (items[0]?.kind === "tile") {
      expect((items[0].options as { section?: string }).section).toBe("ha");
    }
  });

  it("mergeNewServerWidgetsIntoLayout does not append kea_dhcp widget when Kea DHCP is off", () => {
    const partial = buildDefaultLayoutFromDashboard(
      dashboardResponseSchema.parse({
        node: "n",
        version: "1",
        widgets: [{ id: "w1", title: "HA", section: "ha" }],
        sections: { ha: { ok: true, dhcp_mode: "none" }, kea_dhcp: { ok: false } },
      }),
    );
    const full = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [
        { id: "w1", title: "HA", section: "ha" },
        { id: "wk", title: "Kea", section: "kea_dhcp" },
      ],
      sections: { ha: { ok: true, dhcp_mode: "none" }, kea_dhcp: { ok: false } },
    });
    expect(
      mergeNewServerWidgetsIntoLayout(partial, full, {
        dhcp_mode: "none",
        node: "n",
        peer_ui_base_url: null,
        kea_fabric_api_base_url: null,
      }),
    ).toBeNull();
  });

  it("mergeNewServerWidgetsIntoLayout does not append peer_perf widget when Kea DHCP is off", () => {
    const partial = buildDefaultLayoutFromDashboard(
      dashboardResponseSchema.parse({
        node: "n",
        version: "1",
        widgets: [{ id: "w1", title: "HA", section: "ha" }],
        sections: { ha: { ok: true, dhcp_mode: "none" } },
      }),
    );
    const full = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [
        { id: "w1", title: "HA", section: "ha" },
        { id: "peer_perf", title: "Performance (fabric peer)", section: "peer_telemetry" },
      ],
      sections: { ha: { ok: true, dhcp_mode: "none" }, peer_telemetry: { ok: true } },
    });
    expect(
      mergeNewServerWidgetsIntoLayout(partial, full, {
        dhcp_mode: "none",
        node: "n",
        peer_ui_base_url: null,
        kea_fabric_api_base_url: null,
      }),
    ).toBeNull();
  });

  it("pickInitialPiholeCpLayout strips Kea operator tiles from stored layout when DHCP mode is not kea", () => {
    const dashKea = dashboardResponseSchema.parse({
      ...dashboard,
      sections: { ...dashboard.sections, ha: { ok: true, dhcp_mode: "kea" } },
    });
    const storedWithKea = buildPiholeCpDefaultLayout(dashKea, {
      dhcp_mode: "kea",
      node: "x",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
    });
    const dashOff = dashboardResponseSchema.parse({
      ...dashboard,
      sections: { ...dashboard.sections, ha: { ok: true, dhcp_mode: "none" } },
    });
    const picked = pickInitialPiholeCpLayout(dashOff, storedWithKea, {
      dhcp_mode: "none",
      node: "x",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
    });
    const rootPluginIds = picked.items.flatMap((it) => {
      if (it.kind === "tile") return [it.pluginId];
      if (it.kind === "group") {
        return it.children.flatMap((c) => ("pluginId" in c ? [c.pluginId] : []));
      }
      return [];
    });
    expect(rootPluginIds).not.toContain("dhcp.pools");
    expect(rootPluginIds).not.toContain("discovery.records");
  });

  it("layoutContainsPiholeCpKeaDisabledTiles walks nested groups", () => {
    const metaOff = { dhcp_mode: "none" as const, node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null };
    const dashOff = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [],
      sections: { ha: { dhcp_mode: "none" } },
    });
    const layout: DashboardLayoutV3 = {
      version: 3,
      items: [
        {
          kind: "group",
          id: "outer",
          showBorder: true,
          children: [
            {
              kind: "group",
              id: "inner",
              showBorder: true,
              children: [
                {
                  kind: "tile",
                  id: "dhcp",
                  pluginId: "dhcp.pools",
                  hostControl: "single-panel",
                  displayMode: "full",
                },
              ],
            },
          ],
        },
      ],
    };
    expect(layoutContainsPiholeCpKeaDisabledTiles(layout, metaOff, dashOff)).toBe(true);
  });

  it("layoutContainsPiholeCpKeaDisabledTiles is false when Kea DHCP is enabled", () => {
    const metaOn = { dhcp_mode: "kea" as const, node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null };
    const dashOn = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [],
      sections: { ha: { dhcp_mode: "kea" } },
    });
    const layout = buildPiholeCpDefaultLayout(dashOn, metaOn);
    expect(layoutContainsPiholeCpKeaDisabledTiles(layout, metaOn, dashOn)).toBe(false);
    expect(stripPiholeCpLayoutWhenKeaDhcpDisabled(layout, metaOn, dashOn)).toBe(layout);
  });

  it("layoutContainsPiholeCpKeaDisabledTiles is false after strip when meta says Kea DHCP is off", () => {
    const dashKeaLayout = buildPiholeCpDefaultLayout(
      dashboardResponseSchema.parse({
        node: "n",
        version: "1",
        widgets: [],
        sections: { ha: { dhcp_mode: "kea" } },
      }),
      { dhcp_mode: "kea", node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null },
    );
    const dashOff = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [],
      sections: { ha: { dhcp_mode: "none" } },
    });
    const metaOff = { dhcp_mode: "none", node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null };
    expect(layoutContainsPiholeCpKeaDisabledTiles(dashKeaLayout, metaOff, dashOff)).toBe(true);
    const stripped = stripPiholeCpLayoutWhenKeaDhcpDisabled(dashKeaLayout, metaOff, dashOff);
    expect(layoutContainsPiholeCpKeaDisabledTiles(stripped, metaOff, dashOff)).toBe(false);
  });

  it("stripPiholeCpLayoutWhenKeaDhcpDisabled removes peer_telemetry and legacy peer_dhcp section tiles", () => {
    const dashOff = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [],
      sections: { ha: { dhcp_mode: "none" } },
    });
    const metaOff = { dhcp_mode: "none", node: "n", peer_ui_base_url: null, kea_fabric_api_base_url: null };
    const layout: DashboardLayoutV3 = {
      version: 3,
      items: [
        {
          kind: "tile",
          id: "t-peer-sec",
          pluginId: PIHOLE_HA_SECTION_PLUGIN_ID,
          hostControl: "single-panel",
          displayMode: "full",
          options: { section: "peer_dhcp", title: "Peer DHCP", widgetId: "wpeer" },
        },
        {
          kind: "tile",
          id: "t-peer-plug",
          pluginId: pluginIdForPiholeDashboardSection("peer_telemetry"),
          hostControl: "single-panel",
          displayMode: "full",
          options: { section: "peer_telemetry", title: "Perf", widgetId: "peer_perf" },
        },
      ],
    };
    expect(layoutContainsPiholeCpKeaDisabledTiles(layout, metaOff, dashOff)).toBe(true);
    const stripped = stripPiholeCpLayoutWhenKeaDhcpDisabled(layout, metaOff, dashOff);
    expect(stripped.items).toHaveLength(0);
  });

  it("pickInitialPiholeCpLayout with no stored layout uses buildPiholeCpDefaultLayout", () => {
    const picked = pickInitialPiholeCpLayout(dashboard, null);
    expect(picked.items.length).toBeGreaterThan(2);
  });

  it("buildDefaultLayoutFromDashboard emits one section tile per widget with options", () => {
    const layout = buildDefaultLayoutFromDashboard(dashboard);
    expect(layout.version).toBe(3);
    const tiles = layout.items.filter((it) => it.kind === "tile");
    expect(tiles).toHaveLength(2);
    expect(tiles[0]?.kind === "tile" && tiles[0].pluginId).toBe(pluginIdForPiholeDashboardSection("ha"));
    const t0 = tiles[0];
    expect(t0?.kind).toBe("tile");
    if (t0?.kind !== "tile") return;
    expect(t0.options).toEqual({ section: "ha", title: "HA", widgetId: "w1" });
  });

  it("collectPiholeSectionWidgetIds walks nested groups for legacy and per-section plugin ids", () => {
    const layout = {
      version: 3 as const,
      items: [
        {
          kind: "group" as const,
          id: "g1",
          showBorder: true,
          children: [
            {
              kind: "tile" as const,
              id: "t1",
              pluginId: PIHOLE_HA_SECTION_PLUGIN_ID,
              hostControl: "single-panel" as const,
              displayMode: "full" as const,
              options: { section: "ha", title: "HA", widgetId: "w1" },
            },
            {
              kind: "tile" as const,
              id: "t2",
              pluginId: pluginIdForPiholeDashboardSection("pihole_dns"),
              hostControl: "single-panel" as const,
              displayMode: "full" as const,
              options: { section: "pihole_dns", title: "DNS", widgetId: "w2" },
            },
          ],
        },
      ],
    };
    expect([...collectPiholeSectionWidgetIds(layout.items)].sort()).toEqual(["w1", "w2"]);
  });

  it("pickInitialPiholeCpLayout keeps stored layout when widget ids match", () => {
    const stored = buildDefaultLayoutFromDashboard(dashboard);
    const picked = pickInitialPiholeCpLayout(dashboard, stored);
    expect(picked.items).toEqual(stored.items);
  });

  it("buildDefaultLayoutFromDashboard passes optional widget view into tile options", () => {
    const dash = dashboardResponseSchema.parse({
      node: "pi1",
      version: "0.4.0",
      widgets: [
        { id: "x1", title: "Net", section: "ha", view: "ha_network" },
        { id: "x2", title: "DNS", section: "pihole_dns" },
      ],
      sections: { ha: {}, pihole_dns: {} },
    });
    const layout = buildDefaultLayoutFromDashboard(dash);
    const tiles = layout.items.filter((it) => it.kind === "tile");
    expect(tiles).toHaveLength(2);
    const t0 = tiles[0];
    expect(t0?.kind).toBe("tile");
    if (t0?.kind !== "tile") return;
    expect(t0.options).toMatchObject({
      section: "ha",
      title: "Net",
      widgetId: "x1",
      view: "ha_network",
    });
    const t1 = tiles[1];
    expect(t1?.kind).toBe("tile");
    if (t1?.kind !== "tile") return;
    expect(t1.options).toEqual({
      section: "pihole_dns",
      title: "DNS",
      widgetId: "x2",
    });
  });

  it("pickInitialPiholeCpLayout keeps stored layout when server drops widgets but layout still covers remaining ids", () => {
    const stored = buildDefaultLayoutFromDashboard(dashboard);
    const fewer = dashboardResponseSchema.parse({
      ...dashboard,
      widgets: [{ id: "w1", title: "HA", section: "ha" }],
      sections: { ha: { ok: true } },
    });
    const picked = pickInitialPiholeCpLayout(fewer, stored);
    expect(picked.items.length).toBe(2);
  });

  it("pickInitialPiholeCpLayout merges new server widgets into partial stored layout", () => {
    const partial = dashboardResponseSchema.parse({
      ...dashboard,
      widgets: [{ id: "w1", title: "HA", section: "ha" }],
      sections: { ha: { ok: true }, pihole_dns: { ok: true } },
    });
    const stored = buildDefaultLayoutFromDashboard(partial);
    const picked = pickInitialPiholeCpLayout(dashboard, stored);
    expect(picked.items.filter((it) => it.kind === "tile")).toHaveLength(2);
    expect([...collectPiholeSectionWidgetIds(picked.items)].sort()).toEqual(["w1", "w2"]);
  });

  it("mergeNewServerWidgetsIntoLayout returns null when layout already has all widget ids", () => {
    const layout = buildDefaultLayoutFromDashboard(dashboard);
    expect(mergeNewServerWidgetsIntoLayout(layout, dashboard)).toBeNull();
  });

  it("mergeNewServerWidgetsIntoLayout appends tiles for missing widget ids", () => {
    const partial = buildDefaultLayoutFromDashboard(
      dashboardResponseSchema.parse({
        ...dashboard,
        widgets: [{ id: "w1", title: "HA", section: "ha" }],
        sections: { ha: {}, pihole_dns: {} },
      }),
    );
    const merged = mergeNewServerWidgetsIntoLayout(partial, dashboard);
    expect(merged).not.toBeNull();
    expect(merged!.items.filter((it) => it.kind === "tile")).toHaveLength(2);
  });

  it("buildPiholeCpPluginPalette lists full-only ui_dashboard for section tiles", () => {
    const plugins = buildPiholeCpPluginPalette(dashboard, null);
    const ha = plugins.find((p) => p.id === "pihole_ha.ha");
    expect(ha?.ui_dashboard?.supports_full).toBe(true);
    expect(ha?.ui_dashboard?.supports_compact).toBe(false);
  });

  it("buildPiholeCpPluginPalette lists one enabled entry per dashboard section key", () => {
    const plugins = buildPiholeCpPluginPalette(dashboard, null);
    const ids = plugins.map((p) => p.id).sort();
    expect(ids).toEqual(["pihole_ha.ha", "pihole_ha.pihole_dns"]);
    expect(plugins.every((p) => p.enabled)).toBe(true);
  });

  it("buildPiholeCpPluginPalette omits Kea-only sections when DHCP mode is not kea", () => {
    const dash = dashboardResponseSchema.parse({
      node: "n",
      version: "1",
      widgets: [],
      sections: {
        ha: { dhcp_mode: "none" },
        kea_dhcp: {},
        peer_telemetry: {},
        peer_dhcp: {},
        docker: {},
      },
    });
    const plugins = buildPiholeCpPluginPalette(dash, {
      dhcp_mode: "none",
      node: "n",
      peer_ui_base_url: null,
      kea_fabric_api_base_url: null,
    });
    const ids = plugins.map((p) => p.id).sort();
    expect(ids).not.toContain("pihole_ha.kea_dhcp");
    expect(ids).not.toContain("pihole_ha.peer_telemetry");
    expect(ids).not.toContain("pihole_ha.peer_dhcp");
    expect(ids).toContain("pihole_ha.docker");
  });
});
