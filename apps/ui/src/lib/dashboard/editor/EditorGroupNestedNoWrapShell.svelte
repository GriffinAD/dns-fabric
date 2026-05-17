<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { draggable, droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
  import { effectiveColSpan, groupOuterColSpan } from "../gridPlacement";
  import {
    type DashboardDndListItem,
    dndListItemToDashboardTile,
    isDndCellGroup,
  } from "../groupDndFinalize";
  import { nestedContainerDisplayTitle } from "../interactions/editorChrome";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import {
    groupCellPayload,
    groupChildSlotContainer,
    groupEmptyContainer,
  } from "../interactions/dashboardSveltedndTypes";
  import { DASHBOARD_STRIP_GAP_1_PX, flexStripDistributedWidth } from "../stripWidth";
  import {
    CONTAINER_DND_HANDLE,
    editorDndDragAttrs as dndDragAttrs,
    editorDndDropAttrs as dndDropAttrs,
  } from "../interactions/editorChrome";
  import EditorGroupChildTile from "./EditorGroupChildTile.svelte";
  import type { DashboardGroup, DashboardTile } from "../types";

  let {
    parentGroupId,
    cell,
    parentTrackCount,
    nowrapAvailPort,
    dropCb,
    chromeDragSm,
    chromeEditSm,
    editorTileInPlay,
    editorGroupInPlay,
    onEditGroup,
    editLayout,
    onEditTile,
    onItemColSpanChange,
    getSubDndList,
    noWrapEditPortW,
    noWrapStripPortMeasure,
    tileContent,
  }: {
    parentGroupId: string;
    cell: DashboardDndListItem;
    parentTrackCount: number;
    nowrapAvailPort: number;
    dropCb: {
      onDrop: (state: DragDropState<DashboardDragPayload>) => void;
      onDragOver: (state: DragDropState<DashboardDragPayload>) => void;
      onDragEnd: (state: DragDropState<DashboardDragPayload>) => void;
    };
    chromeDragSm: string;
    chromeEditSm: string;
    editorTileInPlay: (id: string) => boolean;
    editorGroupInPlay: (id: string) => boolean;
    onEditGroup?: (g: DashboardGroup) => void;
    editLayout: boolean;
    onEditTile?: (tile: DashboardTile) => void;
    onItemColSpanChange?: (
      itemId: string,
      colSpan: number,
      phase: "preview" | "commit",
      groupId?: string,
    ) => void;
    getSubDndList: (group: DashboardGroup) => DashboardDndListItem[];
    noWrapEditPortW: Record<string, number>;
    noWrapStripPortMeasure: (el: HTMLDivElement, gid: string) => { destroy: () => void };
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  const sub = $derived(cell.item as DashboardGroup);
  const Gs = $derived(groupOuterColSpan(sub));
  const wpx = $derived(
    parentTrackCount > 0 && nowrapAvailPort > 0 ? (nowrapAvailPort * Gs) / parentTrackCount : 0,
  );
  const subList = $derived(getSubDndList(sub));
</script>

<div
  class="editor-nested-container-shell relative box-border flex max-w-none min-w-0 shrink-0 flex-col rounded-md border border-dashed border-gray-200/55 bg-white/35 [min-width:2.5rem] dark:border-gray-600/60 dark:bg-gray-900/35 {editorGroupInPlay(
    sub.id,
  )
    ? 'editor-surface-in-play'
    : ''}"
  style="width: {wpx < 1 ? 120 : wpx}px; min-height: 6rem;"
  title={sub.id}
  data-testid="editor-nested-group"
  data-editor-group="true"
  data-tile-id={cell.id}
  role="group"
  aria-label={`${nestedContainerDisplayTitle(sub.id)} (${sub.id}): drop plugins or add nested container`}
  use:droppable={{
    container: groupChildSlotContainer(parentGroupId, cell.id),
    direction: "horizontal",
    callbacks: dropCb,
    attributes: dndDropAttrs,
  }}
  data-dnd-container={groupChildSlotContainer(parentGroupId, cell.id)}
>
  <div
    data-editor-container-chrome
    use:draggable={{
      dragData: groupCellPayload(parentGroupId, cell.id),
      container: groupChildSlotContainer(parentGroupId, cell.id),
      handle: CONTAINER_DND_HANDLE,
      attributes: dndDragAttrs,
    }}
  >
    <button
      type="button"
      class="{chromeDragSm} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
      aria-label="Drag to reorder nested container in group"
      data-testid="editor-nested-group-drag-handle"
      data-editor-container-chrome
    >
      <GripVertical class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
  {#if editLayout && onEditGroup}
    <button
      type="button"
      class="{chromeEditSm} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
      aria-label="Edit nested container placement"
      data-testid="editor-nested-group-edit"
      data-editor-container-chrome
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => onEditGroup(sub)}
    >
      <Pencil class="h-4 w-4" aria-hidden="true" />
    </button>
  {/if}
  <div
    class="relative flex min-h-0 min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto py-1"
    use:noWrapStripPortMeasure={sub.id}
    use:droppable={{
      container: groupEmptyContainer(sub.id),
      direction: "horizontal",
      callbacks: dropCb,
      attributes: dndDropAttrs,
    }}
    data-dnd-container={groupEmptyContainer(sub.id)}
  >
    {#if subList.length === 0}
      <div
        class="flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center rounded border border-dashed border-gray-200/45 bg-gray-50/50 px-2 text-center text-[10px] text-gray-500 dark:border-gray-600/45 dark:bg-gray-950/25 dark:text-gray-400"
        data-testid="editor-nested-group-empty"
        use:droppable={{
          container: groupEmptyContainer(sub.id),
          direction: "horizontal",
          callbacks: dropCb,
          attributes: dndDropAttrs,
        }}
        data-dnd-container={groupEmptyContainer(sub.id)}
      >
        {nestedContainerDisplayTitle(sub.id)} — drop plugins here
      </div>
    {:else}
      {#each subList as nc (nc.id)}
        {@const nestAvailPort = flexStripDistributedWidth(
          noWrapEditPortW[sub.id] ?? 0,
          subList.length,
          DASHBOARD_STRIP_GAP_1_PX,
        )}
        {#if isDndCellGroup(nc.item)}
          <div
            class="editor-nested-container-shell relative flex min-w-[5rem] shrink-0 flex-col rounded border border-dashed border-gray-200/50 bg-white/35 px-1 py-1 text-[10px] text-gray-500 dark:border-gray-600/55 dark:bg-gray-900/30 dark:text-gray-400"
            data-testid="editor-nested-group-deep"
            title={nc.item.id}
            use:droppable={{
              container: groupChildSlotContainer(sub.id, nc.id),
              direction: "horizontal",
              callbacks: dropCb,
              attributes: dndDropAttrs,
            }}
            data-dnd-container={groupChildSlotContainer(sub.id, nc.id)}
          >
            <div
              class="pointer-events-auto"
              data-editor-container-chrome
              use:draggable={{
                dragData: groupCellPayload(sub.id, nc.id),
                container: groupChildSlotContainer(sub.id, nc.id),
                handle: CONTAINER_DND_HANDLE,
                attributes: dndDragAttrs,
              }}
            >
              <button
                type="button"
                class="{chromeDragSm} text-blue-600 dark:text-blue-300"
                aria-label="Drag to reorder nested container"
                data-testid="editor-nested-group-drag-handle"
                data-editor-container-chrome
              >
                <GripVertical class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <span class="px-0.5">{nestedContainerDisplayTitle(nc.item.id)}</span>
          </div>
        {:else}
          {@const t = dndListItemToDashboardTile(nc)}
          {@const Tn = effectiveColSpan(t)}
          {@const subWpx = Gs > 0 && nestAvailPort > 0 ? (nestAvailPort * Tn) / Gs : 0}
          <EditorGroupChildTile
            groupId={sub.id}
            cellId={nc.id}
            tile={t}
            trackCount={Gs}
            layout="nowrap"
            nowrapWidthPx={subWpx}
            compact
            {dropCb}
            {chromeDragSm}
            {editorTileInPlay}
            {editLayout}
            {onEditTile}
            {onItemColSpanChange}
            {tileContent}
          />
        {/if}
      {/each}
    {/if}
  </div>
</div>
