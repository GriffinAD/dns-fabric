/**
 * Pure built-in grid defaults and hint policy (no Svelte). Consumed by `gridPlacement`,
 * `gridHints`, and perf tiles via `builtinMeta` re-exports.
 */

export const GRID_COLUMNS = 12;

export function clampGridColSpan(n: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 1;
  return Math.min(GRID_COLUMNS, Math.max(1, v));
}

const BUILTIN_DEFAULT_COL_SPAN: Record<string, number> = {
  "perf.summary": 12,
  "perf.cpu": 1,
  "perf.ram": 1,
  "perf.network": 1,
  "perf.disk": 1,
};

/** Perf tiles that only grow colSpan from hints — never force-shrink when a gauge reports fewer columns (e.g. CPU total = one gauge) than the user set in the editor. */
const GRID_HINT_ONLY_EXPAND_COL_SPAN = new Set<string>([
  "perf.cpu",
  "perf.ram",
  "perf.network",
  "perf.disk",
]);

export function builtinDefaultColSpan(pluginId: string): number | undefined {
  const v = BUILTIN_DEFAULT_COL_SPAN[pluginId];
  return v;
}

/** Perf tiles that only grow colSpan from grid hints (never shrink from a hint). */
export function perfGridHintOnlyExpandColSpan(pluginId: string): boolean {
  return GRID_HINT_ONLY_EXPAND_COL_SPAN.has(pluginId);
}

/** Default root `grid.colSpan` when a tile has no saved width. */
export function tileColSpanForPlugin(tile: { pluginId: string }): number {
  return builtinDefaultColSpan(tile.pluginId) ?? 6;
}
