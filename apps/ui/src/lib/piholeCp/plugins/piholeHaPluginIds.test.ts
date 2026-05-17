import { describe, expect, it } from "vitest";

import {
  defaultPaletteOptionsForPiholeHaPlugin,
  humanizePiholeCpSectionKey,
  isLegacyPiholeHaSectionPluginId,
  PIHOLE_HA_SECTION_PLUGIN_ID,
} from "../plugins/piholeHaPluginIds";

describe("piholeHaPluginIds", () => {
  it("humanizePiholeCpSectionKey title-cases snake_case", () => {
    expect(humanizePiholeCpSectionKey("pihole_dns")).toBe("Pihole Dns");
  });

  it("isLegacyPiholeHaSectionPluginId matches the legacy umbrella id only", () => {
    expect(isLegacyPiholeHaSectionPluginId(PIHOLE_HA_SECTION_PLUGIN_ID)).toBe(true);
    expect(isLegacyPiholeHaSectionPluginId("pihole_ha.docker")).toBe(false);
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
