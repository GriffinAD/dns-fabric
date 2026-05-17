<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { draggable, droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
  import { gridAreaStyle, groupOuterColSpan } from "../grid/gridPlacement";
  import type { DashboardDndListItem } from "../grid/groupDndFinalize";
  import {
    CONTAINER_DND_HANDLE,
    EDITOR_LAYOUT_ELEVATED_CLASS,
    editorDndDragAttrs as dndDragAttrs,
    editorDndDropAttrs as dndDropAttrs,
  } from "../interactions/editorChrome";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import { rootCellPayload, rootSlotContainer } from "../interactions/dashboardSveltedndTypes";
  import { dedupeById } from "../layout/layoutTree";
  import TabGroupHost from "../groups/TabGroupHost.svelte";
  import EditorGroupInnerWrap from "./EditorGroupInnerWrap.svelte";
  import EditorGroupNoWrapStrip from "./EditorGroupNoWrapStrip.svelte";
  import type { PluginEntry } from "../../api/types";
  import TileColSpanResizeHandle from "./TileColSpanResizeHandle.svelte";
  import type { DashboardGroup, DashboardTile, RootLayoutItem } from "../types";

  let {
    item,
    group,
    placed,
    dndByGroup,
    dropCb,
    chromeDragSm,
    chromeEditSm,
    editorTileInPlay,
    editorGroupInPlay,
    onEditGroup,
    onGroupChange,
    plugins = [] as PluginEntry[],
    editLayout,
    onEditTile,
    onItemColSpanChange,
    getSubDndList,
    noWrapEditPortW,
    noWrapStripPortMeasure,
    rootGroupGridDropActive,
    groupInnerSurfaceDragActive,
    tileContent,
  }: {
    item: DashboardDndListItem;
    group: DashboardGroup;
    placed: RootLayoutItem | undefined;
    dndByGroup: Record<string, DashboardDndListItem[]>;
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
    onGroupChange?: (g: DashboardGroup) => void;
    plugins?: PluginEntry[];
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
    rootGroupGridDropActive: (groupId: string) => boolean;
    groupInnerSurfaceDragActive: () => boolean;
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  const gItems = $derived(dedupeById(dndByGroup[group.id] ?? []));
  const isGroupEmpty = $derived(!gItems.length);
  const G = $derived(groupOuterColSpan(group));
</script>

<div
  class="editor-root-container-shell {EDITOR_LAYOUT_ELEVATED_CLASS} relative z-[2] flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch rounded-md border border-slate-200/70 bg-transparent pt-2 pb-2 dark:border-gray-500/30 {editorGroupInPlay(group.id)
    ? 'editor-surface-in-play'
    : ''}"
  style={placed?.grid ? gridAreaStyle(placed.grid) : ""}
  data-dashboard-editor="tile-row"
  data-testid="editor-tile"
  data-tile-id={item.id}
  data-editor-group="true"
  role="group"
  aria-label="Container {group.id}: drop plugins here or drag the grip to move"
>
  <div class="editor-container-chrome-rail pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-8 items-start">
    <div
      class="pointer-events-auto"
      data-editor-container-chrome
      use:draggable={{
        dragData: rootCellPayload(item.id),
        container: rootSlotContainer(item.id),
        handle: CONTAINER_DND_HANDLE,
        attributes: dndDragAttrs,
      }}
    >
      <button
        type="button"
        class="{chromeDragSm} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
        aria-label="Drag to move group on dashboard"
        data-testid="editor-container-drag-handle"
        data-editor-container-chrome
      >
        <GripVertical class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    {#if editLayout && onEditGroup}
      <button
        type="button"
        class="{chromeEditSm} pointer-events-auto text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
        aria-label="Edit container placement"
        data-testid="editor-group-edit"
        data-editor-container-chrome
        onclick={() => onEditGroup(group)}
      >
        <Pencil class="h-4 w-4" aria-hidden="true" />
      </button>
    {/if}
  </div>
  {#if editLayout && onItemColSpanChange && placed?.grid?.rowSpan === 1}
    <TileColSpanResizeHandle colSpan={G} maxTracks={G} trackCount={G} onColSpanChange={(cs, phase) => onItemColSpanChange(group.id, cs, phase)} />
  {/if}
  {#if rootGroupGridDropActive(group.id)}
    <div class="editor-group-root-grid-drop editor-group-root-hit-active pointer-events-auto absolute inset-0 z-[45] rounded-md" aria-hidden="true" use:droppable={{ container: rootSlotContainer(item.id), direction: "grid", callbacks: dropCb, attributes: dndDropAttrs }} data-dnd-container={rootSlotContainer(item.id)}></div>
  {/if}
  <div
    class="editor-group-inner relative z-[2] min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-md pl-0 pt-8 {rootGroupGridDropActive(group.id)
      ? 'pointer-events-none'
      : ''}"
    data-editor-group-inner="true"
    role="region"
    aria-label="Container {group.id}: drop plugins or reorder tiles"
  >
    <div class="relative w-full min-h-0 flex-1" class:min-h-28={isGroupEmpty}>
      {#if group.hostControl === "tab-control"}
        <TabGroupHost
          {group}
          {editLayout}
          {onGroupChange}
          layoutDropCb={dropCb}
          {plugins}
          {onEditTile}
          {onEditGroup}
          {tileContent}
        />
      {:else if group.innerWrap === true}
        <EditorGroupInnerWrap
          {group}
          {gItems}
          {isGroupEmpty}
          {dropCb}
          {chromeDragSm}
          {editorTileInPlay}
          {editLayout}
          {onEditTile}
          {onItemColSpanChange}
          {groupInnerSurfaceDragActive}
          {tileContent}
        />
      {:else}
        <EditorGroupNoWrapStrip
          {group}
          {gItems}
          {isGroupEmpty}
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
          {groupInnerSurfaceDragActive}
          {tileContent}
        />
      {/if}
      {#if isGroupEmpty && group.innerWrap === true}
        <div
          class="pointer-events-none absolute inset-0 z-0 flex min-h-28 flex-col items-center justify-center gap-1 rounded border border-dashed border-gray-200/65 bg-gray-50/55 px-2 py-4 dark:border-gray-600 dark:bg-gray-900/30"
          data-testid="editor-group-empty"
        >
          <p class="text-center text-xs text-gray-500 dark:text-gray-400">
            Drop a plugin from the palette here, or add tiles and reorder with the grip
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
