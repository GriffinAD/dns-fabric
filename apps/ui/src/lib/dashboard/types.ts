import type { DisplayMode, HostControl, TileOptions } from "../api/types";

export type { TileOptions };

/** Max nesting depth for `kind: "group"` under the root (`items` depth = 1). */
export const MAX_DASHBOARD_GROUP_DEPTH = 8;

/** Root grid placement (same 0…(GRID_COLUMNS−1) column contract; see `pluginGridPolicy.GRID_COLUMNS`). */
export interface GridPlacement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/**
 * A dashboard tile. May appear on the **root** grid or as a child of a `group` (inner grid;
 * `grid` is then relative to the group’s inner columns / rows).
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
 * Tile or nested group inside a container. v2 wire format only allows tiles here; v3 allows
 * recursive groups (see `DashboardLayoutV3`).
 */
export type GroupChild = DashboardTile | DashboardGroup;

export function isDashboardGroupNode(c: GroupChild): c is DashboardGroup {
  return (c as DashboardGroup).kind === "group";
}

/**
 * A container that sits on the root grid and holds tiles on an inner G×n grid
 * (same column semantics as the main dashboard); can span any root rows/columns.
 */
export interface DashboardGroup {
  kind: "group";
  id: string;
  /** When true, draw a border on the group and hide inner tile card chrome. Default true. */
  showBorder: boolean;
  /**
   * When true, child tiles are laid out in array order, wrapping to a new row when a row
   * would exceed the container width (G root columns), with grid positions repacked on save.
   * When false or omitted, children keep saved col/colSpan; horizontal position can extend past
   * a root-width “pack” so one row can scroll (see `GROUP_CHILD_INNER_STRIP_MAX_EXTENT` in gridPlacement).
   *
   * v3: when `innerWrap` is true, **children must be tiles only** (no nested groups).
   */
  innerWrap?: boolean;
  /** Placement on the root grid (`GRID_COLUMNS` wide). */
  grid?: GridPlacement;
  children: GroupChild[];
}

/** Root-level tile (not nested in a group). */
export type RootTileItem = DashboardTile & { kind: "tile" };

export type RootLayoutItem = RootTileItem | DashboardGroup;

export interface DashboardLayoutV3 {
  version: 3;
  items: RootLayoutItem[];
}

export interface DashboardLayoutV2 {
  version: 2;
  items: RootLayoutItem[];
}

/** v1: flat `tiles` only. Load path migrates to v2 in memory, then to v3 for the live store. */
export interface DashboardLayoutV1 {
  version: 1;
  tiles: DashboardTile[];
}

export type DashboardLayout = DashboardLayoutV1 | DashboardLayoutV2 | DashboardLayoutV3;

/** Canonical layout document for the operator store (v3). */
export type DashboardLayoutCanonical = DashboardLayoutV3;

export function isLayoutV3(l: DashboardLayout): l is DashboardLayoutV3 {
  return l.version === 3 && Array.isArray((l as DashboardLayoutV3).items);
}

export function isLayoutV2(l: DashboardLayout): l is DashboardLayoutV2 {
  return l.version === 2 && Array.isArray((l as DashboardLayoutV2).items);
}

export function isLayoutV2OrV3(l: DashboardLayout): l is DashboardLayoutV2 | DashboardLayoutV3 {
  return isLayoutV2(l) || isLayoutV3(l);
}
