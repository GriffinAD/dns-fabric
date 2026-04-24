<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";

  import type { DataGateway } from "../dataGateway";
  import { resolvePluginTileMount } from "../plugins/registry";
  import type { DashboardTile } from "./types";

  let {
    gateway,
    tile,
    liveCpuPercent,
    editLayout = false,
    onEditTile,
    onPerfTileGridHint,
  }: {
    gateway: DataGateway;
    tile: DashboardTile;
    liveCpuPercent?: number | null;
    editLayout?: boolean;
    onEditTile?: (t: DashboardTile) => void;
    onPerfTileGridHint?: (tileId: string, hint: { colSpan: number; rowSpan: number }) => void;
  } = $props();

  const resolved = $derived(
    resolvePluginTileMount({
      gateway,
      tile,
      liveCpuPercent,
      editLayout,
      onEditTile,
      onPerfTileGridHint,
    }),
  );
</script>

{#if resolved}
  {@const Comp = resolved.component}
  <Comp {...resolved.props} />
{:else}
  <Card size="xl" class="box-border !max-w-full w-full min-w-0 flex-1 min-h-0 flex-col">
    {#snippet children()}
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{tile.pluginId}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">Unknown plugin (placeholder).</p>
    {/snippet}
  </Card>
{/if}
