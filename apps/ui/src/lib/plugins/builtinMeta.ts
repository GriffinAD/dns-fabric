/**
 * Built-in plugin layout metadata only (no Svelte components).
 * Imported by `gridPlacement` / `gridHints` without pulling in the component graph.
 */

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
