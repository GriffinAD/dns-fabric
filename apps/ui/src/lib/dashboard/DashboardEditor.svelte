<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";

  import type { PluginEntry } from "../api/types";
  import type { DashboardLayout } from "./types";

  let {
    plugins,
    layout,
    onAddTile,
  }: {
    plugins: PluginEntry[];
    layout: DashboardLayout;
    onAddTile: (pluginId: string) => void;
  } = $props();

  const palette = $derived(plugins.filter((p) => p.enabled && p.ui_dashboard));
</script>

<div class="flex flex-col gap-4" data-testid="dashboard-editor" aria-label="Dashboard editor">
  <p class="text-sm text-gray-600 dark:text-gray-400">
    {layout.tiles.length} tile(s) on canvas. Add from the palette (drag-and-drop in a later slice).
  </p>
  <div class="flex flex-wrap gap-2">
    {#each palette as p (p.id)}
      <Button type="button" onclick={() => onAddTile(p.id)} class="text-sm">
        Add {p.name}
      </Button>
    {/each}
  </div>
</div>
