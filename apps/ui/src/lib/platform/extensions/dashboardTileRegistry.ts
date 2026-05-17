/**
 * Host-facing entry for resolving built-in (and future registered) dashboard tiles.
 * Product code should import from here; `lib/plugins/registry.ts` remains the implementation.
 */
export {
  resolvePluginTileMount,
  type PluginRegistration,
  type ResolvedPluginMount,
  type TileHostContext,
} from "../../plugins/core/registry";
