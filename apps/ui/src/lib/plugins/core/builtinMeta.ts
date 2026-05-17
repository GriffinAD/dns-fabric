/**
 * Built-in plugin layout metadata only (no Svelte components).
 * Re-exports pure policy from `pluginGridPolicy.ts` for existing imports.
 */

export {
  GRID_COLUMNS,
  clampGridColSpan,
  tileColSpanForPlugin,
  builtinDefaultColSpan,
  perfGridHintOnlyExpandColSpan,
} from "./pluginGridPolicy";
