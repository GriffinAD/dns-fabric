<script lang="ts">
  import type { PluginEntry } from "../api/types";
  import type { DataGateway } from "../dataGateway";
  import { resolvePluginTileMount } from "../plugins/registry";
  import TileErrorBoundary from "./TileErrorBoundary.svelte";
  import TileFallback from "./TileFallback.svelte";
  import TileHostControl from "./TileHostControl.svelte";
  import type { DashboardTile } from "./types";

  let {
    gateway,
    tile,
    plugins = [] as PluginEntry[],
    editLayout = false,
    onEditTile,
    onPerfTileGridHint,
  }: {
    gateway: DataGateway;
    tile: DashboardTile;
    plugins?: PluginEntry[];
    editLayout?: boolean;
    onEditTile?: (t: DashboardTile) => void;
    onPerfTileGridHint?: (tileId: string, hint: { colSpan: number; rowSpan: number }) => void;
  } = $props();

  const pluginEntry = $derived(plugins.find((p) => p.id === tile.pluginId));

  const resolved = $derived(
    resolvePluginTileMount({
      gateway,
      tile,
      editLayout,
      onEditTile,
      onPerfTileGridHint,
    }),
  );
</script>

{#if pluginEntry && pluginEntry.enabled === false}
  <TileFallback reason="disabled" pluginId={tile.pluginId} />
{:else if resolved == null}
  <TileFallback reason="unknown" pluginId={tile.pluginId} />
{:else}
  <TileHostControl hostControl={tile.hostControl} pluginId={tile.pluginId}>
    {#snippet children()}
      <TileErrorBoundary pluginId={tile.pluginId}>
        {#snippet children()}
          {@const Comp = resolved.component}
          <Comp {...resolved.props} />
        {/snippet}
      </TileErrorBoundary>
    {/snippet}
  </TileHostControl>
{/if}
