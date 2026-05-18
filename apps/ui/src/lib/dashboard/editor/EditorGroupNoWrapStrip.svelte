<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import { effectiveColSpan, groupOuterColSpan } from "../grid/gridPlacement";
  import {
    type DashboardDndListItem,
    dndListItemToDashboardTile,
    isDndCellGroup,
  } from "../grid/groupDndFinalize";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import {
    groupAppendContainer,
    groupCanvasContainer,
    groupEmptyContainer,
    groupGapAfterContainer,
  } from "../interactions/dashboardSveltedndTypes";
  import { DASHBOARD_STRIP_GAP_2_PX, flexStripDistributedWidth } from "../layout/stripWidth";
  import { editorDndDropAttrs as dndDropAttrs } from "../interactions/editorChrome";
  import EditorGroupChildTile from "./EditorGroupChildTile.svelte";
  import EditorGroupNestedNoWrapShell from "./EditorGroupNestedNoWrapShell.svelte";
  import type { DashboardGroup, DashboardTile } from "../types";

  let {
    group,
    gItems,
    isGroupEmpty,
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
    groupInnerSurfaceDragActive,
    tileContent,
  }: {
    group: DashboardGroup;
    gItems: DashboardDndListItem[];
    isGroupEmpty: boolean;
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
    groupInnerSurfaceDragActive: () => boolean;
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  const G = $derived(groupOuterColSpan(group));
</script>

<div
  class="relative flex h-full w-full min-h-0 min-w-0 max-w-full flex-nowrap content-start items-stretch gap-2 overflow-x-auto overflow-y-hidden {isGroupEmpty
    ? 'min-h-28'
    : ''}"
  use:noWrapStripPortMeasure={group.id}
  use:droppable={{
    container: groupEmptyContainer(group.id),
    direction: "horizontal",
    callbacks: dropCb,
    attributes: dndDropAttrs,
  }}
  data-dnd-container={groupEmptyContainer(group.id)}
  data-editor-group-surface-drop={isGroupEmpty ? "true" : undefined}
>
  {#if isGroupEmpty}
    <div
      class="pointer-events-auto min-h-28 min-w-full flex-1 rounded-md border border-dashed border-gray-200/65 bg-gray-50/40 dark:border-gray-600 dark:bg-gray-900/30"
      use:droppable={{
        container: groupEmptyContainer(group.id),
        direction: "horizontal",
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={groupEmptyContainer(group.id)}
      data-editor-group-surface-drop="true"
      data-testid="editor-group-nowrap-empty"
      aria-label="Drop plugins here"
    ></div>
  {:else}
    <div
      class="editor-group-canvas-drop editor-root-canvas-drop absolute inset-0 z-0 min-h-full shrink-0 rounded-md {groupInnerSurfaceDragActive()
        ? 'pointer-events-auto'
        : 'pointer-events-none'}"
      use:droppable={{
        container: groupCanvasContainer(group.id),
        direction: "horizontal",
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={groupCanvasContainer(group.id)}
      data-editor-group-surface-drop="true"
      data-testid="editor-group-canvas-drop-nowrap"
      aria-hidden="true"
    ></div>
    {#each gItems as c, gi (c.id)}
      {#if gi > 0}
        <div
          class="editor-group-gap-drop editor-root-gap-drop z-[3] min-h-[2.75rem] w-2 shrink-0 rounded-md border border-dashed border-transparent {groupInnerSurfaceDragActive()
            ? 'pointer-events-auto'
            : 'pointer-events-none'}"
          use:droppable={{
            container: groupGapAfterContainer(group.id, gItems[gi - 1]!.id),
            direction: "horizontal",
            callbacks: dropCb,
            attributes: dndDropAttrs,
          }}
          data-dnd-container={groupGapAfterContainer(group.id, gItems[gi - 1]!.id)}
          data-editor-group-surface-drop="true"
          aria-hidden="true"
        ></div>
      {/if}
      {@const nowrapAvailPort = flexStripDistributedWidth(
        noWrapEditPortW[group.id] ?? 0,
        gItems.length,
        DASHBOARD_STRIP_GAP_2_PX,
      )}
      {#if isDndCellGroup(c.item)}
        <EditorGroupNestedNoWrapShell
          parentGroupId={group.id}
          cell={c}
          parentTrackCount={G}
          {nowrapAvailPort}
          {dropCb}
          {chromeDragSm}
          {chromeEditSm}
          {editorTileInPlay}
          {editorGroupInPlay}
          {onEditGroup}
          {editLayout}
          {onEditTile}
          {onItemColSpanChange}
          {getSubDndList}
          {noWrapEditPortW}
          {noWrapStripPortMeasure}
          {tileContent}
        />
      {:else}
        {@const t = dndListItemToDashboardTile(c)}
        {@const T = effectiveColSpan(t)}
        {@const wpx = G > 0 && nowrapAvailPort > 0 ? (nowrapAvailPort * T) / G : 0}
        <EditorGroupChildTile
          groupId={group.id}
          cellId={c.id}
          tile={t}
          trackCount={G}
          layout="nowrap"
          nowrapWidthPx={wpx}
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
    <div
      class="editor-group-append-drop editor-root-append-drop z-[3] min-h-[2.75rem] min-w-[2.5rem] shrink-0 grow rounded-md border border-dashed border-transparent {groupInnerSurfaceDragActive()
        ? 'pointer-events-auto'
        : 'pointer-events-none'}"
      use:droppable={{
        container: groupAppendContainer(group.id),
        direction: "horizontal",
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={groupAppendContainer(group.id)}
      data-editor-group-surface-drop="true"
      data-testid="editor-group-append-drop"
      aria-hidden="true"
    ></div>
  {/if}
</div>
