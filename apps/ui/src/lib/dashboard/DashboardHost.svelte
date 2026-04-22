<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";

  import type { DashboardLayout } from "./types";

  let { layout }: { layout: DashboardLayout } = $props();
</script>

<div class="grid gap-4 md:grid-cols-2" data-testid="dashboard-host" aria-label="Dashboard tiles">
  {#each layout.tiles as tile (tile.id)}
    <Card>
      {#snippet children()}
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{tile.pluginId}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {tile.hostControl} · {tile.displayMode}
          {#if tile.region}
            · {tile.region}
          {/if}
        </p>
      {/snippet}
    </Card>
  {/each}
</div>
