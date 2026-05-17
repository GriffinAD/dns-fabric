<script lang="ts">
  import CrashTile from "../__fixtures__/CrashTile.svelte";
  import TileErrorBoundary from "./TileErrorBoundary.svelte";

  let { crash }: { crash: boolean } = $props();
</script>

<TileErrorBoundary pluginId="vitest.tile">
  {#snippet children()}
    {#if crash}
      <CrashTile />
    {:else}
      <span data-testid="boundary-ok">ok</span>
    {/if}
  {/snippet}
</TileErrorBoundary>
