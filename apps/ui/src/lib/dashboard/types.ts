import type { DisplayMode, HostControl, TileOptions } from "../api/types";

export type { TileOptions };

export interface DashboardTile {
  id: string;
  pluginId: string;
  hostControl: HostControl;
  displayMode: DisplayMode;
  region?: string;
  options?: TileOptions;
}

export interface DashboardLayout {
  version: number;
  tiles: DashboardTile[];
}
