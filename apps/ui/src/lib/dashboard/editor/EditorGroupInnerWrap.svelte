<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import { groupOuterColSpan } from "../grid/gridPlacement";
  import {
    type DashboardDndListItem,
    dndListItemToDashboardTile,
    isDndCellGroup,
  } from "../grid/groupDndFinalize";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import {
    groupCanvasContainer,
    groupEmptyContainer,
    groupGapAfterContainer,
  } from "../interactions/dashboardSveltedndTypes";
  import { editorDndDropAttrs as dndDropAttrs } from "../interactions/editorChrome";
  import EditorGroupChildTile from "./EditorGroupChildTile.svelte";
  import type { DashboardGroup, DashboardTile } from "../types";

  let {
    group,
    gItems,
    isGroupEmpty,
    dropCb,
    chromeDragSm,
    editorTileInPlay,
    editLayout,
    onEditTile,
    onItemColSpanChange,
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
    editorTileInPlay: (id: string) => boolean;
    editLayout: boolean;
    onEditTile?: (tile: DashboardTile) => void;
    onItemColSpanChange?: (
      itemId: string,
      colSpan: number,
      phase: "preview" | "commit",
      groupId?: string,
    ) => void;
    groupInnerSurfaceDragActive: () => boolean;
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  const G = $derived(groupOuterColSpan(group));
</script>

{#if isGroupEmpty}
  <div
    class="flex min-h-28 w-full flex-wrap content-start items-stretch gap-2 rounded-md border border-dashed border-gray-200/65 bg-gray-50/40 dark:border-gray-600 dark:bg-gray-900/30"
    use:droppable={{
      container: groupEmptyContainer(group.id),
      callbacks: dropCb,
      attributes: dndDropAttrs,
    }}
    data-dnd-container={groupEmptyContainer(group.id)}
    data-testid="editor-group-inner-empty"
  ></div>
{:else}
  <div
    class="relative flex h-full min-h-0 w-full min-w-0 flex-wrap content-start items-stretch gap-2"
    use:droppable={{
      container: groupEmptyContainer(group.id),
      callbacks: dropCb,
      attributes: dndDropAttrs,
    }}
    data-dnd-container={groupEmptyContainer(group.id)}
  >
    <div
      class="editor-group-canvas-drop editor-root-canvas-drop absolute inset-0 z-0 min-h-full rounded-md {groupInnerSurfaceDragActive()
        ? 'pointer-events-auto'
        : 'pointer-events-none'}"
      use:droppable={{
        container: groupCanvasContainer(group.id),
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={groupCanvasContainer(group.id)}
      data-editor-group-surface-drop="true"
      data-testid="editor-group-canvas-drop"
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
            callbacks: dropCb,
            attributes: dndDropAttrs,
          }}
          data-dnd-container={groupGapAfterContainer(group.id, gItems[gi - 1]!.id)}
          data-editor-group-surface-drop="true"
          aria-hidden="true"
        ></div>
      {/if}
      {#if isDndCellGroup(c.item)}
        <div
          class="rounded border border-red-200/80 bg-red-50/40 px-2 py-1 text-[10px] text-red-700 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300"
          data-testid="editor-invalid-nested-under-wrap"
        >
          Nested groups are not allowed when Auto wrap is on.
        </div>
      {:else}
        {@const t = dndListItemToDashboardTile(c)}
        <EditorGroupChildTile
          groupId={group.id}
          cellId={c.id}
          tile={t}
          trackCount={G}
          layout="wrap"
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
  </div>
{/if}
