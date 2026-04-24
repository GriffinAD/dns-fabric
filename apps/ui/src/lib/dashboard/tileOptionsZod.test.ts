import { describe, expect, it } from "vitest";

import { dashboardLayoutJsonSchema } from "./layoutZod";
import { tileOptionsSchemaForPlugin } from "./tileOptionsZod";

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
