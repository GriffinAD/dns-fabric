<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { draggable, droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import { effectiveColSpan, effectiveRowSpan } from "../gridPlacement";
  import {
    EDITOR_PLUGIN_CAPTION_BAR_CLASS,
    EDITOR_PLUGIN_HOVER_SHELL,
    EDITOR_TILE_IN_GROUP_DRAG_VISIBLE,
    nestedContainerDisplayTitle,
  } from "../interactions/editorChrome";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import {
    groupCellPayload,
    groupChildSlotContainer,
  } from "../interactions/dashboardSveltedndTypes";
  import {
    EDITOR_TILE_DND_HANDLE as TILE_HANDLE,
    editorDndDragAttrs as dndDragAttrs,
    editorDndDropAttrs as dndDropAttrs,
  } from "../interactions/editorChrome";
  import TileColSpanResizeHandle from "./TileColSpanResizeHandle.svelte";
  import TileEditChrome from "../TileEditChrome.svelte";
  import type { DashboardTile } from "../types";

  let {
    groupId,
    cellId,
    tile,
    trackCount,
    layout,
    nowrapWidthPx,
    compact = false,
    dropCb,
    chromeDragSm,
    editorTileInPlay,
    editLayout,
    onEditTile,
    onItemColSpanChange,
    tileContent,
  }: {
    groupId: string;
    cellId: string;
    tile: DashboardTile;
    trackCount: number;
    layout: "wrap" | "nowrap";
    nowrapWidthPx?: number;
    compact?: boolean;
    dropCb: {
      onDrop: (state: DragDropState<DashboardDragPayload>) => void;
      onDragOver: (state: DragDropState<DashboardDragPayload>) => void;
      onDragEnd: (state: DragDropState<DashboardDragPayload>) => void;
    };
    chromeDragSm: string;
    editorTileInPlay: (id: string) => boolean;
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

  const T = $derived(effectiveColSpan(tile));
  const rs = $derived(effectiveRowSpan(tile));
  const gripClass = $derived(compact ? "h-3.5 w-3.5" : "h-4 w-4");
  const shellClass = $derived(
    layout === "wrap"
      ? `${EDITOR_PLUGIN_HOVER_SHELL} relative z-[4] box-border flex min-h-0 max-w-full min-w-0 flex-col rounded border border-dashed border-gray-200/45 bg-white/40 dark:border-gray-600/50 dark:bg-gray-900/20`
      : compact
        ? `${EDITOR_PLUGIN_HOVER_SHELL} relative min-w-[5rem] shrink-0 rounded border border-dashed border-gray-200/45 bg-white/45 p-1 dark:border-gray-600/50 dark:bg-gray-900/30`
        : `${EDITOR_PLUGIN_HOVER_SHELL} relative z-[4] box-border flex max-w-none min-w-0 shrink-0 flex-col rounded border border-dashed border-gray-200/45 bg-white/40 [min-width:2.5rem] dark:border-gray-600/50 dark:bg-gray-900/20`,
  );
  const shellStyle = $derived.by(() => {
    if (layout === "wrap") {
      const rowMin =
        rs > 1 ? ` min-height: ${Math.min(12, rs) * 2.25}rem;` : "";
      return `flex: 0 0 min(100%, calc(100% * ${T} / ${trackCount}));${rowMin}`;
    }
    const wpx = nowrapWidthPx ?? 0;
    const width = wpx < 1 ? 40 : wpx;
    const rowMin =
      rs > 1
        ? ` min-height: ${Math.min(12, rs) * 2.25}rem;`
        : " min-height: 0;";
    return `width: ${width}px;${rowMin}`;
  });
  const captionPad = $derived(compact ? "pl-0.5 pr-0.5" : "pl-1 pr-1");
  const dragLabel = $derived(
    compact
      ? "Drag to reorder tile in nested container"
      : "Drag to reorder tile in group",
  );
</script>

<div
  class="{shellClass} {editorTileInPlay(cellId) ? 'editor-surface-in-play' : ''}"
  style={shellStyle}
  data-dashboard-editor="tile-row"
  data-testid="editor-tile"
  data-tile-id={cellId}
  use:draggable={{
    dragData: groupCellPayload(groupId, cellId),
    container: groupChildSlotContainer(groupId, cellId),
    handle: TILE_HANDLE,
    attributes: dndDragAttrs,
  }}
  use:droppable={{
    container: groupChildSlotContainer(groupId, cellId),
    direction: "horizontal",
    callbacks: dropCb,
    attributes: dndDropAttrs,
  }}
  data-dnd-container={groupChildSlotContainer(groupId, cellId)}
>
  <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} {captionPad}" title={groupId}>
    {nestedContainerDisplayTitle(groupId)}
  </p>
  <div class="relative min-h-0 w-full min-w-0 flex-1">
    <button
      type="button"
      class="{EDITOR_TILE_IN_GROUP_DRAG_VISIBLE} {chromeDragSm} text-emerald-600 dark:text-emerald-300"
      aria-label={dragLabel}
      data-testid="editor-tile-drag-handle"
    >
      <GripVertical class={gripClass} aria-hidden="true" />
    </button>
    <div class="min-h-0 w-full min-w-0 {compact ? 'pt-0' : 'flex-1 pt-0'}">
      <TileEditChrome tile={tile} onEdit={onEditTile} showEditButton={editLayout}>
        {#snippet children()}
          {@render tileContent(tile)}
        {/snippet}
      </TileEditChrome>
    </div>
    {#if !compact && editLayout && onItemColSpanChange && rs === 1}
      <TileColSpanResizeHandle
        colSpan={T}
        maxTracks={trackCount}
        trackCount={trackCount}
        onColSpanChange={(cs, phase) => onItemColSpanChange(tile.id, cs, phase, groupId)}
      />
    {/if}
  </div>
</div>
