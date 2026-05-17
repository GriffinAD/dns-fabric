<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { draggable, droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import {
    effectiveColSpan,
    gridAreaStyle,
    gridColumnSpanStyle,
  } from "../grid/gridPlacement";
  import type { DashboardDndListItem } from "../grid/groupDndFinalize";
  import {
    EDITOR_LAYOUT_ELEVATED_CLASS,
    EDITOR_PLUGIN_CAPTION_BAR_CLASS,
    EDITOR_PLUGIN_HOVER_SHELL,
    EDITOR_PLUGIN_HOVER_VISIBLE,
  } from "../interactions/editorChrome";
  import {
    rootCellPayload,
    rootSlotContainer,
  } from "../interactions/dashboardSveltedndTypes";
  import TileColSpanResizeHandle from "./TileColSpanResizeHandle.svelte";
  import TileEditChrome from "../tiles/TileEditChrome.svelte";
  import type { DashboardTile, RootLayoutItem } from "../types";

  const TILE_HANDLE = '[data-testid="editor-tile-drag-handle"]';

  const dndDragAttrs = { draggingClass: "opacity-90 shadow-md rounded-md ring-2 ring-primary-500/35" };
  const dndDropAttrs = {
    dragOverClass:
      "svelte-dnd-drop-target outline outline-2 outline-dashed outline-offset-[3px] rounded-md outline-primary-500",
  };

  let {
    item,
    tile,
    placed,
    dropCb,
    chromeDragSm,
    chromeEditSm,
    editorTileInPlay,
    rootPluginTileHitActive,
    editLayout,
    onEditTile,
    onItemColSpanChange,
    tileContent,
  }: {
    item: DashboardDndListItem;
    tile: DashboardTile;
    placed: RootLayoutItem | undefined;
    dropCb: {
      onDrop: (state: DragDropState<DashboardDragPayload>) => void;
      onDragOver: (state: DragDropState<DashboardDragPayload>) => void;
      onDragEnd: (state: DragDropState<DashboardDragPayload>) => void;
    };
    chromeDragSm: string;
    chromeEditSm: string;
    editorTileInPlay: (id: string) => boolean;
    rootPluginTileHitActive: () => boolean;
    editLayout: boolean;
    onEditTile?: (tile: DashboardTile) => void;
    onItemColSpanChange?: (
      itemId: string,
      colSpan: number,
      phase: "preview" | "commit",
      groupId?: string,
    ) => void;
    tileContent: Snippet<[DashboardTile]>;
  } = $props();
</script>

<div
  class="{EDITOR_PLUGIN_HOVER_SHELL} {EDITOR_LAYOUT_ELEVATED_CLASS} relative z-[2] flex w-full max-w-full flex-col self-start rounded-md {editorTileInPlay(item.id)
    ? 'editor-surface-in-play'
    : ''}"
  style={placed?.grid ? gridAreaStyle(placed.grid) : gridColumnSpanStyle(tile)}
  data-dashboard-editor="tile-row"
  data-testid="editor-tile"
  data-tile-id={item.id}
  use:draggable={{
    dragData: rootCellPayload(item.id),
    container: rootSlotContainer(item.id),
    handle: TILE_HANDLE,
    attributes: dndDragAttrs,
  }}
>
  <div
    class="editor-root-tile-dnd-hit absolute inset-0 z-[30] rounded-md {rootPluginTileHitActive()
      ? 'editor-root-tile-hit-active'
      : ''}"
    aria-hidden="true"
    data-editor-root-surface-drop="true"
    use:droppable={{
      container: rootSlotContainer(item.id),
      direction: "grid",
      callbacks: dropCb,
      attributes: dndDropAttrs,
    }}
    data-dnd-container={rootSlotContainer(item.id)}
  ></div>
  {#if placed?.kind === "tile" && placed.grid}
    <p
      class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-1 pr-2"
      title="Span {placed.grid.colSpan}×{placed.grid.rowSpan} · row {placed.grid.row + 1}"
    >
      Span {placed.grid.colSpan}×{placed.grid.rowSpan} · row {placed.grid.row + 1}
    </p>
  {/if}
  <div class="relative flex min-h-0 min-w-0 w-full flex-1 flex-col pt-0">
    <button
      type="button"
      class="{EDITOR_PLUGIN_HOVER_VISIBLE} {chromeDragSm} text-emerald-600 dark:text-emerald-300"
      aria-label="Drag to reorder tile"
      data-testid="editor-tile-drag-handle"
    >
      <GripVertical class="h-5 w-5" aria-hidden="true" />
    </button>
    <div class="min-h-0 w-full min-w-0 flex-1">
      <TileEditChrome
        tile={tile}
        onEdit={onEditTile}
        showEditButton={editLayout}
      >
        {#snippet children()}
          {@render tileContent(tile)}
        {/snippet}
      </TileEditChrome>
    </div>
    {#if editLayout && onItemColSpanChange && placed?.kind === "tile" && placed.grid?.rowSpan === 1}
      <TileColSpanResizeHandle
        colSpan={effectiveColSpan(tile)}
        maxTracks={20}
        trackCount={20}
        onColSpanChange={(cs, phase) => onItemColSpanChange(tile.id, cs, phase)}
      />
    {/if}
  </div>
</div>
