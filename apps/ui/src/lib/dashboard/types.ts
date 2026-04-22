import type { DisplayMode, HostControl, TileOptions } from "../api/types";

export type { TileOptions };

/** 12-column grid placement (optional; Phase C editor). */
export interface GridPlacement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface DashboardTile {
  id: string;
  pluginId: string;
  hostControl: HostControl;
  displayMode: DisplayMode;
  region?: string;
  grid?: GridPlacement;
  options?: TileOptions;
}

export interface DashboardLayout {
  version: number;
  tiles: DashboardTile[];
}
