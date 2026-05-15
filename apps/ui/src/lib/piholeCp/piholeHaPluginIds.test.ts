import { describe, expect, it } from "vitest";

import {
  defaultPaletteOptionsForPiholeHaPlugin,
  humanizePiholeCpSectionKey,
  PIHOLE_HA_SECTION_PLUGIN_ID,
} from "./piholeHaPluginIds";

describe("piholeHaPluginIds", () => {
  it("humanizePiholeCpSectionKey title-cases snake_case", () => {
    expect(humanizePiholeCpSectionKey("pihole_dns")).toBe("Pihole Dns");
  });

  it("defaultPaletteOptionsForPiholeHaPlugin maps legacy pihole_ha.section to HA defaults", () => {
    const o = defaultPaletteOptionsForPiholeHaPlugin(PIHOLE_HA_SECTION_PLUGIN_ID);
    expect(o).toMatchObject({ section: "ha", title: "Ha" });
    expect(typeof o?.widgetId).toBe("string");
  });

  it("defaultPaletteOptionsForPiholeHaPlugin returns undefined for bare pihole_ha. prefix", () => {
    expect(defaultPaletteOptionsForPiholeHaPlugin("pihole_ha.")).toBeUndefined();
  });
});
