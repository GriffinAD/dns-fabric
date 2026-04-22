import type { DisplayMode, HostControl } from "../api/types";

export interface DashboardTile {
  id: string;
  pluginId: string;
  hostControl: HostControl;
  displayMode: DisplayMode;
  region?: string;
}

export interface DashboardLayout {
  version: number;
  tiles: DashboardTile[];
}
