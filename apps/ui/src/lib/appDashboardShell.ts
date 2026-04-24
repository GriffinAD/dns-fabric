import { get } from "svelte/store";

import type { DataGateway } from "./dataGateway";
import { createLayoutStore } from "./dashboard/layoutStore";
import { createOverlayActions } from "./dashboard/overlayActions";
import type { DashboardGroup, DashboardTile } from "./dashboard/types";

export type OverlaySettingsBinding = {
  getTile: () => DashboardTile | null;
  setTile: (t: DashboardTile | null) => void;
  getGroup: () => DashboardGroup | null;
  setGroup: (g: DashboardGroup | null) => void;
};

/** Layout store + overlay actions for `App.svelte` (UI_ENGINE_PLAN P6). */
export function createAppDashboardShell(gateway: DataGateway, settings: OverlaySettingsBinding) {
  const ls = createLayoutStore({ gateway });
  const overlay = createOverlayActions({
    getLayout: () => get(ls.layout),
    getEditorOpen: () => get(ls.editorOpen),
    getSettingsTile: settings.getTile,
    getSettingsGroup: settings.getGroup,
    setSettingsTile: settings.setTile,
    setSettingsGroup: settings.setGroup,
    applyLayoutStructure: ls.applyStructure,
  });
  return { ls, overlay };
}
