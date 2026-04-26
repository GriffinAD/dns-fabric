import type { PluginEntry } from "../api/types";

/** Catalog entry for the edit-mode palette (plugins + host “core” layout actions). */
export type PaletteItem =
  | {
      kind: "plugin";
      id: string;
      label: string;
      category: string;
      /** Lowercased text used for search filtering. */
      searchText: string;
      source: PluginEntry;
    }
  | {
      kind: "core";
      id: "core:add-group";
      label: string;
      category: string;
      searchText: string;
    };

/** Normalised drop payload after host validation (palette → canvas / group). */
export type PaletteDrop = { kind: "group" } | { kind: "plugin"; id: string };
