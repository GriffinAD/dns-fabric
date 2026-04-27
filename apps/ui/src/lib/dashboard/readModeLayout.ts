import { dedupeById } from "./layoutTree";
import type { DashboardTile } from "./types";

/**
 * Read view, Auto wrap off: keep a single horizontal row ordered by grid position.
 */
export function noWrapReadRowGroups(tiles: DashboardTile[]): DashboardTile[][] {
  if (tiles.length === 0) return [];
  const unique = dedupeById(tiles);
  const sorted = [...unique].sort(
    (a, b) => (a.grid?.row ?? 0) - (b.grid?.row ?? 0) || (a.grid?.col ?? 0) - (b.grid?.col ?? 0),
  );
  return [sorted];
}
