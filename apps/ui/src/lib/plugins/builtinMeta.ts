/**
 * Built-in plugin layout metadata only (no Svelte components).
 * Imported by `gridPlacement` / `gridHints` without pulling in the component graph.
 */

/** Visible dashboard columns; must match API / layout.schema.json. */
export const GRID_COLUMNS = 12;

export function clampGridColSpan(n: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 1;
  return Math.min(GRID_COLUMNS, Math.max(1, v));
}

/** Default root `grid.colSpan` for layout hint math (same as `gridPlacement.tileColSpan`). */
export function tileColSpanForPlugin(tile: { pluginId: string }): number {
  return builtinDefaultColSpan(tile.pluginId) ?? 6;
}

/** Default root `grid.colSpan` when a tile has no saved width (matches former `tileColSpan` switch). */
export function builtinDefaultColSpan(pluginId: string): number | undefined {
  if (pluginId === "perf.summary") return 12;
  if (
    pluginId === "perf.cpu" ||
    pluginId === "perf.ram" ||
    pluginId === "perf.network" ||
    pluginId === "perf.disk"
  ) {
    return 1;
  }
  return undefined;
}

/** Perf tiles that only grow colSpan from grid hints (never shrink from a hint). */
export function perfGridHintOnlyExpandColSpan(pluginId: string): boolean {
  return pluginId === "perf.ram";
}
