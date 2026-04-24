<script lang="ts">
  import type { Snippet } from "svelte";

  import TileFallback from "./TileFallback.svelte";

  let { pluginId, children }: { pluginId: string; children: Snippet } = $props();
</script>

<svelte:boundary>
  {@render children()}
  {#snippet failed(error, reset)}
    <TileFallback
      reason="error"
      {pluginId}
      details={error instanceof Error ? error.message : String(error)}
      onRetry={reset}
    />
  {/snippet}
</svelte:boundary>
