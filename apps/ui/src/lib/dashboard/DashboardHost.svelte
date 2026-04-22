<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import Card from "flowbite-svelte/Card.svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import {
    dragHandle,
    dragHandleZone,
    FEATURE_FLAG_NAMES,
    setFeatureFlag,
  } from "svelte-dnd-action";

  /** Grid zones: keep rects in sync; see svelte-dnd-action issue #454. */
  setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, true);

  import type { PluginEntry } from "../api/types";
  import { DataGateway } from "../dataGateway";
  import CpuTile from "../plugins/CpuTile.svelte";
  import DhcpClientsTile from "../plugins/DhcpClientsTile.svelte";
  import DhcpPoolsTile from "../plugins/DhcpPoolsTile.svelte";
  import DhcpReservationsTile from "../plugins/DhcpReservationsTile.svelte";
  import DiskTile from "../plugins/DiskTile.svelte";
  import DiscoveryTile from "../plugins/DiscoveryTile.svelte";
  import NwTile from "../plugins/NwTile.svelte";
  import PerfTile from "../plugins/PerfTile.svelte";
  import RamTile from "../plugins/RamTile.svelte";
  import {
    gridAreaStyle,
    gridColumnSpanStyle,
    reorderTilesPreservingSlotOrigins,
  } from "./gridPlacement";
  import TileEditChrome from "./TileEditChrome.svelte";
  import type { DashboardLayout, DashboardTile } from "./types";

  type DndItem = { id: string; tile: DashboardTile };

  let {
    layout,
    gateway,
    liveCpuPercent,
    onEditTile,
    editLayout = false,
    plugins = [] as PluginEntry[],
    onAddTile,
    onLayoutStructureChange,
    onPerfTileGridHint,
  }: {
    layout: DashboardLayout;
    gateway: DataGateway;
    liveCpuPercent?: number | null;
    onEditTile?: (tile: DashboardTile) => void;
    /** When true, show palette + drag handles and reorder on the live dashboard grid. */
    editLayout?: boolean;
    plugins?: PluginEntry[];
    onAddTile?: (pluginId: string) => void;
    onLayoutStructureChange?: (next: DashboardLayout) => void;
    onPerfTileGridHint?: (tileId: string, hint: { colSpan: number; rowSpan: number }) => void;
  } = $props();

  const placedTiles = $derived(layout.tiles);

  let dndItems = $state<DndItem[]>([]);

  $effect(() => {
    dndItems = layout.tiles.map((t) => ({ id: t.id, tile: t }));
  });

  const palette = $derived(plugins.filter((p) => p.enabled && p.ui_dashboard));
  const packedPreview = $derived(
    reorderTilesPreservingSlotOrigins(
      layout.tiles,
      dndItems.map((i) => i.tile),
    ),
  );
  const packedById = $derived(new Map(packedPreview.map((t) => [t.id, t])));

  const flipDurationMs = 180;

  function handleConsider(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
  }

  function handleFinalize(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
    const reordered = e.detail.items.map((i) => i.tile);
    const tiles = reorderTilesPreservingSlotOrigins(layout.tiles, reordered);
    onLayoutStructureChange?.({
      ...layout,
      tiles,
    });
  }

  function onPaletteDragStart(e: DragEvent, pluginId: string) {
    e.dataTransfer?.setData("application/x-kea-plugin-id", pluginId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  }

  function onCanvasDrop(e: DragEvent) {
    e.preventDefault();
    const pid = e.dataTransfer?.getData("application/x-kea-plugin-id");
    if (pid) onAddTile?.(pid);
  }
</script>

{#snippet renderTile(tile: DashboardTile)}
  {#if tile.pluginId === "dhcp.pools"}
    <DhcpPoolsTile {gateway} {tile} />
  {:else if tile.pluginId === "dhcp.clients"}
    <DhcpClientsTile {gateway} {tile} />
  {:else if tile.pluginId === "dhcp.reservations"}
    <DhcpReservationsTile {gateway} {tile} />
  {:else if tile.pluginId === "discovery.records"}
    <DiscoveryTile
      {gateway}
      {tile}
      onOpenSettings={editLayout && onEditTile ? () => onEditTile(tile) : undefined}
    />
  {:else if tile.pluginId === "perf.summary"}
    <PerfTile {gateway} {tile} {liveCpuPercent} />
  {:else if tile.pluginId === "perf.cpu"}
    <CpuTile
      {gateway}
      {tile}
      {liveCpuPercent}
      onGridHint={onPerfTileGridHint ? (hint) => onPerfTileGridHint(tile.id, hint) : undefined}
    />
  {:else if tile.pluginId === "perf.ram"}
    <RamTile
      {gateway}
      {tile}
      onGridHint={onPerfTileGridHint ? (hint) => onPerfTileGridHint(tile.id, hint) : undefined}
    />
  {:else if tile.pluginId === "perf.network"}
    <NwTile
      {gateway}
      {tile}
      onGridHint={onPerfTileGridHint ? (hint) => onPerfTileGridHint(tile.id, hint) : undefined}
    />
  {:else if tile.pluginId === "perf.disk"}
    <DiskTile
      {gateway}
      {tile}
      onGridHint={onPerfTileGridHint ? (hint) => onPerfTileGridHint(tile.id, hint) : undefined}
    />
  {:else}
    <Card size="xl">
      {#snippet children()}
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{tile.pluginId}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">Unknown plugin (placeholder).</p>
      {/snippet}
    </Card>
  {/if}
{/snippet}

<div class="flex flex-col gap-4" data-testid="dashboard-host">
  {#if editLayout && palette.length > 0}
    <div
      class="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/50"
      data-testid="layout-edit-palette"
      aria-label="Add dashboard plugins"
    >
      <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">
        Drag the grip on a tile to reorder. Drop a plugin chip onto the grid below to add a tile. Use the pencil to
        resize and configure.
      </p>
      <div class="flex flex-wrap gap-2">
        {#each palette as p (p.id)}
          <Button
            type="button"
            draggable="true"
            class="text-sm"
            ondragstart={(e: DragEvent) => onPaletteDragStart(e, p.id)}
            onclick={() => onAddTile?.(p.id)}
          >
            Add {p.name}
          </Button>
        {/each}
      </div>
    </div>
  {/if}

  {#if editLayout}
    <div
      class="relative min-h-[120px] rounded-lg border-2 border-dashed border-gray-300 p-3 dark:border-gray-600"
      data-testid="editor-grid-chrome"
    >
      <div class="pointer-events-none absolute inset-3 grid grid-cols-12 gap-3" aria-hidden="true">
        {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
          <div
            class="min-h-[4rem] border-l border-gray-200/90 first:border-l-0 dark:border-gray-600/90"
          ></div>
        {/each}
      </div>
      <div
        class="relative z-[1] grid min-h-[120px] grid-cols-12 gap-4 auto-rows-min pb-[min(50vh,40rem)]"
        data-testid="editor-drop-zone"
        role="region"
        aria-label="Dashboard tile grid"
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => onCanvasDrop(e)}
        use:dragHandleZone={{
          items: dndItems,
          flipDurationMs,
          type: "tiles",
          autoAriaDisabled: true,
          morphDisabled: true,
        }}
        onconsider={handleConsider}
        onfinalize={handleFinalize}
      >
        {#each dndItems as item (item.id)}
          {@const placed = packedById.get(item.id)}
          <div
            class="relative min-h-0 min-w-0 rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            style={placed?.grid ? gridAreaStyle(placed.grid) : gridColumnSpanStyle(item.tile)}
            data-testid="editor-tile"
            data-tile-id={item.id}
          >
            <button
              type="button"
              class="absolute left-1 top-1 z-20 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:bg-gray-50 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="Drag to reorder tile"
              data-testid="editor-tile-drag-handle"
              use:dragHandle
            >
              <GripVertical class="h-5 w-5" aria-hidden="true" />
            </button>
            <div class="min-h-0 min-w-0">
              <TileEditChrome tile={item.tile} onEdit={onEditTile} showEditButton={editLayout}>
                {#snippet children()}
                  {#if placed?.grid}
                    <p
                      class="border-b border-gray-100 py-1 pl-10 pr-2 text-[10px] text-gray-400 dark:border-gray-700 dark:text-gray-500"
                    >
                      Span {placed.grid.colSpan}×{placed.grid.rowSpan} · row {placed.grid.row + 1}
                    </p>
                  {/if}
                  {@render renderTile(item.tile)}
                {/snippet}
              </TileEditChrome>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-12 gap-4 auto-rows-min" aria-label="Dashboard tiles">
      {#each placedTiles as tile (tile.id)}
        <div
          class="min-h-0 min-w-0"
          style={tile.grid ? gridAreaStyle(tile.grid) : gridColumnSpanStyle(tile)}
        >
          <TileEditChrome {tile} onEdit={onEditTile} showEditButton={editLayout}>
            {#snippet children()}
              {@render renderTile(tile)}
            {/snippet}
          </TileEditChrome>
        </div>
      {/each}
    </div>
  {/if}
</div>
