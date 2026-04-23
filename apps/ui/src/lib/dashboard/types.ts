import type { DisplayMode, HostControl, TileOptions } from "../api/types";

export type { TileOptions };

/** 12-column grid placement (root grid or inner group grid, same 0–11 column contract). */
export interface GridPlacement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/**
 * A dashboard tile. May appear on the **root** grid or as a child of a `group` (inner grid;
 * `grid` is then relative to the group’s 12 columns / rows).
 */
export interface DashboardTile {
  id: string;
  pluginId: string;
  hostControl: HostControl;
  displayMode: DisplayMode;
  region?: string;
  /** v1 only; migrated away in v2 (use a `group` instead). */
  rowPanel?: string;
  grid?: GridPlacement;
  options?: TileOptions;
}

/**
 * A container that sits on the root grid and holds tiles on an inner 12×n grid
 * (same column semantics as the main dashboard); can span any root rows/columns.
 */
export interface DashboardGroup {
  kind: "group";
  id: string;
  /** When true, draw a border on the group and hide inner tile card chrome. Default true. */
  showBorder: boolean;
  /** Placement on the root 12-column grid. */
  grid?: GridPlacement;
  children: DashboardTile[];
}

/** Root-level tile (not nested in a group). */
export type RootTileItem = DashboardTile & { kind: "tile" };

export type RootLayoutItem = RootTileItem | DashboardGroup;

export interface DashboardLayoutV2 {
  version: 2;
  items: RootLayoutItem[];
}

/** v1: flat `tiles` only. Load path migrates to v2 in memory. */
export interface DashboardLayoutV1 {
  version: 1;
  tiles: DashboardTile[];
}

export type DashboardLayout = DashboardLayoutV1 | DashboardLayoutV2;

export function isLayoutV2(l: DashboardLayout): l is DashboardLayoutV2 {
  return l.version === 2 && Array.isArray((l as DashboardLayoutV2).items);
}
