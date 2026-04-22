<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import { dndzone } from "svelte-dnd-action";

  import type { PluginEntry } from "../api/types";
  import type { DashboardLayout, DashboardTile } from "./types";

  type DndItem = { id: string; tile: DashboardTile };

  let {
    plugins,
    layout,
    onAddTile,
    onLayoutChange,
  }: {
    plugins: PluginEntry[];
    layout: DashboardLayout;
    onAddTile: (pluginId: string) => void;
    onLayoutChange: (next: DashboardLayout) => void;
  } = $props();

  let dndItems = $state<DndItem[]>([]);

  $effect(() => {
    dndItems = layout.tiles.map((t) => ({ id: t.id, tile: t }));
  });

  const palette = $derived(plugins.filter((p) => p.enabled && p.ui_dashboard));

  const flipDurationMs = 180;

  function handleConsider(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
  }

  function handleFinalize(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
    onLayoutChange({
      ...layout,
      tiles: e.detail.items.map((i) => i.tile),
    });
  }

  function onPaletteDragStart(e: DragEvent, pluginId: string) {
    e.dataTransfer?.setData("application/x-kea-plugin-id", pluginId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  }

  function onCanvasDrop(e: DragEvent) {
    e.preventDefault();
    const pid = e.dataTransfer?.getData("application/x-kea-plugin-id");
    if (pid) onAddTile(pid);
  }
</script>

<div class="flex flex-col gap-4" data-testid="dashboard-editor" aria-label="Dashboard editor">
  <p class="text-sm text-gray-600 dark:text-gray-400">
    {layout.tiles.length} tile(s). Reorder below or drag a palette chip onto the dashed area.
  </p>
  <div class="flex flex-wrap gap-2">
    {#each palette as p (p.id)}
      <Button
        type="button"
        draggable="true"
        class="text-sm"
        ondragstart={(e: DragEvent) => onPaletteDragStart(e, p.id)}
        onclick={() => onAddTile(p.id)}
      >
        Add {p.name}
      </Button>
    {/each}
  </div>
  <div
    class="min-h-[140px] rounded-lg border-2 border-dashed border-gray-300 p-3 dark:border-gray-600"
    data-testid="editor-drop-zone"
    role="region"
    aria-label="Drop plugins to add tiles"
    ondragover={(e) => e.preventDefault()}
    ondrop={(e) => onCanvasDrop(e)}
    use:dndzone={{ items: dndItems, flipDurationMs, type: "tiles" }}
    onconsider={handleConsider}
    onfinalize={handleFinalize}
  >
    {#each dndItems as item (item.id)}
      <div
        class="mb-2 cursor-grab rounded-md border border-gray-200 bg-white p-3 active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800"
        data-testid="editor-tile"
        data-tile-id={item.id}
      >
        <p class="font-medium text-gray-900 dark:text-white">{item.tile.pluginId}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">{item.tile.hostControl} · {item.tile.displayMode}</p>
      </div>
    {/each}
  </div>
</div>
