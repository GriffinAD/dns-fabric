<script lang="ts">
  import { droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import type { DashboardDndListItem } from "../grid/groupDndFinalize";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import {
    ROOT_EMPTY_CONTAINER,
    rootAppendContainer,
    rootCanvasContainer,
    rootGapAfterContainer,
    rootRowEndContainer,
  } from "../interactions/dashboardSveltedndTypes";
  import type { DragDropState } from "@thisux/sveltednd";

  export type RootRowGapDropSlot = {
    key: string;
    row: number;
    startCol: number;
    span: number;
    afterId: string;
  };
  export type RootRowEndDropSlot = {
    key: string;
    row: number;
    startCol: number;
    span: number;
    targetId: string;
  };

  const dndDropAttrs = {
    dragOverClass:
      "svelte-dnd-drop-target outline outline-2 outline-dashed outline-offset-[3px] rounded-md outline-primary-500",
  };

  let {
    dndRoot,
    dropCb,
    rootGridColumnCount,
    rootGridMinWidthPercent,
    rootRowGapDropSlots,
    rootRowEndDropSlots,
    editorPointerDndActive,
    rootAppendGridRow,
    children,
  }: {
    dndRoot: DashboardDndListItem[];
    dropCb: {
      onDrop: (state: DragDropState<DashboardDragPayload>) => void;
      onDragOver: (state: DragDropState<DashboardDragPayload>) => void;
      onDragEnd: (state: DragDropState<DashboardDragPayload>) => void;
    };
    rootGridColumnCount: number;
    rootGridMinWidthPercent: string;
    rootRowGapDropSlots: RootRowGapDropSlot[];
    rootRowEndDropSlots: RootRowEndDropSlot[];
    editorPointerDndActive: boolean;
    rootAppendGridRow: number;
    children: Snippet;
  } = $props();
</script>

<div
  class="relative grid min-h-[120px] w-full auto-rows-[minmax(0,auto)] content-start place-items-stretch pb-[min(50vh,40rem)] {editorPointerDndActive
    ? 'editor-root-dnd-active'
    : ''}"
  style="grid-template-columns: repeat({rootGridColumnCount}, minmax(0, 1fr)); min-width: max(100%, {rootGridMinWidthPercent});"
  data-dashboard-editor="drop-zone"
  data-testid="editor-drop-zone"
  role="group"
  aria-label="Dashboard tile grid"
>
  {#if dndRoot.length === 0}
    <div
      class="min-h-28 rounded-md border border-dashed border-slate-200/70 bg-slate-50/40 dark:border-gray-600 dark:bg-gray-900/25"
      style="grid-column: 1 / -1;"
      use:droppable={{
        container: ROOT_EMPTY_CONTAINER,
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={ROOT_EMPTY_CONTAINER}
      data-testid="editor-root-empty-drop"
      aria-label="Empty dashboard — drop a tile here"
    ></div>
  {:else}
    <div
      class="editor-root-canvas-drop pointer-events-auto absolute inset-0 z-0 min-h-full rounded-md"
      use:droppable={{
        container: rootCanvasContainer(),
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={rootCanvasContainer()}
      data-editor-root-surface-drop="true"
      data-testid="editor-root-canvas-drop"
      aria-label="Drop on empty grid space"
    ></div>
  {/if}
  {#each rootRowGapDropSlots as slot (slot.key)}
    <div
      class="editor-root-gap-drop pointer-events-auto z-[3] min-h-[2.75rem] rounded-md border border-dashed border-transparent"
      style="grid-column: {slot.startCol + 1} / span {slot.span}; grid-row: {slot.row + 1} / span 1;"
      use:droppable={{
        container: rootGapAfterContainer(slot.afterId),
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={rootGapAfterContainer(slot.afterId)}
      data-editor-root-surface-drop="true"
      aria-label="Drop in gap between tiles"
    ></div>
  {/each}
  {#each rootRowEndDropSlots as slot (slot.key)}
    <div
      class="editor-root-row-end-drop pointer-events-auto z-[3] min-h-[2.75rem] rounded-md border border-dashed border-transparent"
      style="grid-column: {slot.startCol + 1} / span {slot.span}; grid-row: {slot.row + 1} / span 1;"
      use:droppable={{
        container: rootRowEndContainer(slot.targetId),
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={rootRowEndContainer(slot.targetId)}
      data-editor-root-surface-drop="true"
      aria-label="Drop target at row end"
    ></div>
  {/each}
  {@render children()}
  {#if dndRoot.length > 0}
    <div
      class="editor-root-append-drop pointer-events-auto z-[3] min-h-[2.75rem] rounded-md border border-dashed border-transparent"
      style="grid-column: 1 / -1; grid-row: {rootAppendGridRow} / span 1;"
      use:droppable={{
        container: rootAppendContainer(),
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={rootAppendContainer()}
      data-editor-root-surface-drop="true"
      data-testid="editor-root-append-drop"
      aria-label="Drop to add a new row below"
    ></div>
  {/if}
</div>
