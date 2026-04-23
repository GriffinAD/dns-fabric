import { GRID_COLUMNS } from "./gridPlacement";

/**
 * Split `trackCount` virtual columns across `n` gauges in one row.
 * Returns integer column spans (sum = trackCount) so gauge cell edges line up with that sub-grid
 * (e.g. 8 when the parent container spans 8 root columns, not 12).
 * When `n > trackCount`, returns `null` (caller should use an equal-`fr` row instead).
 */
export function columnSpansOn(trackCount: number, n: number): number[] | null {
  const c = Math.max(1, Math.min(GRID_COLUMNS, Math.floor(trackCount)));
  if (n <= 0) return [];
  if (n > c) return null;
  const base = Math.floor(c / n);
  const rem = c - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/** @deprecated use columnSpansOn(12, n) for clarity; kept for call sites. */
export function columnSpansOn12(n: number): number[] | null {
  return columnSpansOn(12, n);
}
