import type { PluginEntry } from "../api/types";

import type { PaletteItem } from "./types";

function pluginCategoryFromId(id: string): string {
  const dot = id.indexOf(".");
  if (dot > 0) return id.slice(0, dot).toUpperCase();
  return "Plugins";
}

/** Deterministic sort: core first, then plugins by category then label. */
export function buildPaletteCatalog(plugins: PluginEntry[]): PaletteItem[] {
  const core: PaletteItem = {
    kind: "core",
    id: "core:add-group",
    label: "Add container",
    category: "Layout",
    searchText: "add container layout group",
  };
  const pluginItems: PaletteItem[] = plugins
    .filter((p) => p.enabled)
    .map((p) => {
      const category = pluginCategoryFromId(p.id);
      return {
        kind: "plugin" as const,
        id: p.id,
        label: p.name,
        category,
        searchText: `${p.name} ${p.id} ${category}`.toLowerCase(),
        source: p,
      };
    });
  pluginItems.sort((a, b) => {
    const c = a.category.localeCompare(b.category);
    if (c !== 0) return c;
    return a.label.localeCompare(b.label);
  });
  return [core, ...pluginItems];
}
