import { GRID_COLUMNS } from "../../plugins/core/builtinMeta";

export { clampGridColSpan, GRID_COLUMNS } from "../../plugins/core/builtinMeta";

/** Max vertical span of a single tile (dashboard rows are unbounded). */
export const GRID_ROW_SPAN_MAX = 12;

/**
 * For group children when **Auto wrap is off** (`innerWrap` not true), horizontal
 * `col`/`colSpan` use the same 1/N “dashboard width” units (N = `GRID_COLUMNS`), but a row can extend
 * **past N** along X so many tiles can sit on one scroller row (no `col+colSpan ≤ N`).
 */
export const GROUP_CHILD_INNER_STRIP_MAX_EXTENT = 10_000;

/** Physical track count G for nowrap strip math (bounded by {@link GRID_COLUMNS}, at least 1). */
export function stripInnerPhysicalTrackCount(innerOrParentG: number): number {
  return Math.max(1, Math.min(GRID_COLUMNS, Math.floor(Number(innerOrParentG)) || 1));
}
