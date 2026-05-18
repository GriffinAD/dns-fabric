import { describe, expect, it } from "vitest";

import { dashboardLayoutJsonSchema } from "./layoutZod";
import { tileOptionsSchemaForPlugin } from "../../plugins/core/tileOptionsZod";

const BUILTIN_PLUGIN_IDS = [
  "dhcp.pools",
  "dhcp.clients",
  "dhcp.reservations",
  "discovery.records",
  "perf.summary",
  "perf.cpu",
  "perf.ram",
  "perf.network",
  "perf.disk",
] as const;

describe("tileOptionsSchemaForPlugin", () => {
  it.each([...BUILTIN_PLUGIN_IDS])("accepts empty options object for %s", (pluginId) => {
    expect(tileOptionsSchemaForPlugin(pluginId).safeParse({}).success).toBe(true);
  });

  it("accepts perf option keys for perf.* plugins", () => {
    const opts = {
      cpu_total: true,
      network_by_adapter: false,
      disk_by_volume: true,
      display_style: "gauge" as const,
      gauge_gradient_mode: "smooth" as const,
      perf_max_cols: 6,
    };
    for (const id of ["perf.cpu", "perf.summary", "perf.disk"] as const) {
      const r = tileOptionsSchemaForPlugin(id).safeParse(opts);
      expect(r.success, id).toBe(true);
    }
  });

  it("rejects unknown keys on perf tiles (strict)", () => {
    const r = tileOptionsSchemaForPlugin("perf.cpu").safeParse({ extra_field: 1 });
    expect(r.success).toBe(false);
  });

  it("rejects non-empty options on non-perf plugins", () => {
    const r = tileOptionsSchemaForPlugin("dhcp.pools").safeParse({ foo: 1 });
    expect(r.success).toBe(false);
  });

  it("accepts optional nested table settings for non-perf plugins", () => {
    const r = tileOptionsSchemaForPlugin("dhcp.clients").safeParse({
      table: {
        allowSort: false,
        allowModal: true,
        pageSize: 25,
        rowHeightMode: "compact",
        defaultSortColumnId: "hostname",
        defaultSortDirection: "desc",
        interactionMode: "inline",
      },
    });
    expect(r.success).toBe(true);
  });

  it("accepts legacy interactionMode alias and normalizes to inline", () => {
    const r = tileOptionsSchemaForPlugin("dhcp.clients").safeParse({
      table: { interactionMode: "inline-expanded" },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const parsed = r.data as { table?: { interactionMode?: string } };
    expect(parsed.table?.interactionMode).toBe("inline");
  });

  it("rejects unknown keys inside options.table (strict)", () => {
    const r = tileOptionsSchemaForPlugin("dhcp.reservations").safeParse({
      table: { unknownFlag: true },
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid pageSize inside options.table", () => {
    const r = tileOptionsSchemaForPlugin("dhcp.pools").safeParse({
      table: { pageSize: 0 },
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid rowHeightMode inside options.table", () => {
    const r = tileOptionsSchemaForPlugin("dhcp.pools").safeParse({
      table: { rowHeightMode: "tiny" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid defaultSortDirection inside options.table", () => {
    const r = tileOptionsSchemaForPlugin("dhcp.pools").safeParse({
      table: { defaultSortDirection: "up" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid interactionMode inside options.table", () => {
    const r = tileOptionsSchemaForPlugin("dhcp.pools").safeParse({
      table: { interactionMode: "drawer" },
    });
    expect(r.success).toBe(false);
  });

  it("accepts pihole_ha.section options with optional view", () => {
    const r = tileOptionsSchemaForPlugin("pihole_ha.section").safeParse({
      section: "ha",
      title: "HA",
      widgetId: "w1",
      view: "ha_network",
    });
    expect(r.success).toBe(true);
  });

  it("accepts pihole_ha.section options shape", () => {
    const r = tileOptionsSchemaForPlugin("pihole_ha.section").safeParse({
      section: "ha",
      title: "HA",
      widgetId: "w1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown keys on pihole_ha.section (strict)", () => {
    const r = tileOptionsSchemaForPlugin("pihole_ha.section").safeParse({
      section: "ha",
      title: "HA",
      widgetId: "w1",
      extra: 1,
    });
    expect(r.success).toBe(false);
  });

  it("accepts the same options shape for per-section pihole_ha.<section> plugin ids", () => {
    const r = tileOptionsSchemaForPlugin("pihole_ha.docker").safeParse({
      section: "docker",
      title: "Docker",
      widgetId: "w9",
    });
    expect(r.success).toBe(true);
  });

  it("integrates with layout Zod for each built-in id", () => {
    for (const pluginId of BUILTIN_PLUGIN_IDS) {
      const tile = {
        id: "x",
        pluginId,
        hostControl: "single-panel",
        displayMode: "full",
        grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        options: {},
      };
      const layout = { version: 2 as const, items: [tile] };
      expect(dashboardLayoutJsonSchema.safeParse(layout).success, pluginId).toBe(true);
    }
  });
});
