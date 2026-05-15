/** Prefix for Pi-hole HA control-plane dashboard tiles (`pihole_ha.<section>`). */
export const PIHOLE_HA_PLUGIN_PREFIX = "pihole_ha.";

/** Legacy umbrella plugin id (still accepted in saved layouts). */
export const PIHOLE_HA_SECTION_PLUGIN_ID = "pihole_ha.section";

export function pluginIdForPiholeDashboardSection(section: string): string {
  return `${PIHOLE_HA_PLUGIN_PREFIX}${section}`;
}

/** True for `pihole_ha.<section>` tiles; false for the legacy `pihole_ha.section` id. */
export function isPiholeHaPerSectionPluginId(pluginId: string): boolean {
  return pluginId.startsWith(PIHOLE_HA_PLUGIN_PREFIX) && pluginId !== PIHOLE_HA_SECTION_PLUGIN_ID;
}

export function humanizePiholeCpSectionKey(section: string): string {
  return section
    .split("_")
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Default `tile.options` when adding a Pi-hole palette tile (layout editor). */
export function defaultPaletteOptionsForPiholeHaPlugin(
  pluginId: string,
): Record<string, string> | undefined {
  if (pluginId === PIHOLE_HA_SECTION_PLUGIN_ID) {
    return {
      section: "ha",
      title: humanizePiholeCpSectionKey("ha"),
      widgetId: `palette-${Date.now()}`,
    };
  }
  if (isPiholeHaPerSectionPluginId(pluginId)) {
    const section = pluginId.slice(PIHOLE_HA_PLUGIN_PREFIX.length);
    if (!section) return undefined;
    return {
      section,
      title: humanizePiholeCpSectionKey(section),
      widgetId: `palette-${Date.now()}`,
    };
  }
  return undefined;
}
