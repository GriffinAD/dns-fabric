<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { draggable, droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
  import {
    effectiveColSpan,
    effectiveRowSpan,
    gridAreaStyle,
    groupOuterColSpan,
  } from "../gridPlacement";
  import {
    type DashboardDndListItem,
    dndListItemToDashboardTile,
    isDndCellGroup,
  } from "../groupDndFinalize";
  import {
    EDITOR_LAYOUT_ELEVATED_CLASS,
    EDITOR_PLUGIN_CAPTION_BAR_CLASS,
    EDITOR_PLUGIN_HOVER_SHELL,
    EDITOR_TILE_IN_GROUP_DRAG_VISIBLE,
    nestedContainerDisplayTitle,
  } from "../interactions/editorChrome";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import {
    groupAppendContainer,
    groupCanvasContainer,
    groupCellPayload,
    groupChildSlotContainer,
    groupEmptyContainer,
    groupGapAfterContainer,
    rootCellPayload,
    rootSlotContainer,
  } from "../interactions/dashboardSveltedndTypes";
  import { dedupeById } from "../layoutTree";
  import { DASHBOARD_STRIP_GAP_1_PX, DASHBOARD_STRIP_GAP_2_PX, flexStripDistributedWidth } from "../stripWidth";
  import TileColSpanResizeHandle from "./TileColSpanResizeHandle.svelte";
  import TileEditChrome from "../TileEditChrome.svelte";
  import type { DashboardGroup, DashboardTile, RootLayoutItem } from "../types";

  const CONTAINER_DND_HANDLE =
    '[data-testid="editor-container-drag-handle"],[data-testid="editor-nested-group-drag-handle"]';
  const TILE_HANDLE = '[data-testid="editor-tile-drag-handle"]';

  const dndDragAttrs = { draggingClass: "opacity-90 shadow-md rounded-md ring-2 ring-primary-500/35" };
  const dndDropAttrs = {
    dragOverClass:
      "svelte-dnd-drop-target outline outline-2 outline-dashed outline-offset-[3px] rounded-md outline-primary-500",
  };

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
  const isGroupEmpty = $derived(gItems.length === 0);
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
  <div
    class="editor-container-chrome-rail pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-8 items-start"
  >
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
    <TileColSpanResizeHandle
      colSpan={G}
      maxTracks={G}
      trackCount={G}
      onColSpanChange={(cs, phase) => onItemColSpanChange(group.id, cs, phase)}
    />
  {/if}
  {#if rootGroupGridDropActive(group.id)}
    <div
      class="editor-group-root-grid-drop editor-group-root-hit-active pointer-events-auto absolute inset-0 z-[45] rounded-md"
      aria-hidden="true"
      use:droppable={{
        container: rootSlotContainer(item.id),
        direction: "grid",
        callbacks: dropCb,
        attributes: dndDropAttrs,
      }}
    data-dnd-container={rootSlotContainer(item.id)}
    ></div>
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
      {#if group.innerWrap === true}
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
              {@const T = effectiveColSpan(t)}
              {@const rs = effectiveRowSpan(t)}
              <div
                class="{EDITOR_PLUGIN_HOVER_SHELL} relative z-[4] box-border flex min-h-0 max-w-full min-w-0 flex-col rounded border border-dashed border-gray-200/45 bg-white/40 dark:border-gray-600/50 dark:bg-gray-900/20 {editorTileInPlay(c.id)
                  ? 'editor-surface-in-play'
                  : ''}"
                style="flex: 0 0 min(100%, calc(100% * {T} / {G}));{rs > 1
                  ? ` min-height: ${Math.min(12, rs) * 2.25}rem;`
                  : ''}"
                data-dashboard-editor="tile-row"
                data-testid="editor-tile"
                data-tile-id={c.id}
                use:draggable={{
                  dragData: groupCellPayload(group.id, c.id),
                  container: groupChildSlotContainer(group.id, c.id),
                  handle: TILE_HANDLE,
                  attributes: dndDragAttrs,
                }}
                use:droppable={{
                  container: groupChildSlotContainer(group.id, c.id),
                  direction: "horizontal",
                  callbacks: dropCb,
                  attributes: dndDropAttrs,
                }}
                data-dnd-container={groupChildSlotContainer(group.id, c.id)}
              >
                <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-1 pr-1" title={group.id}>
                  {nestedContainerDisplayTitle(group.id)}
                </p>
                <div class="relative min-h-0 w-full min-w-0 flex-1">
                  <button
                    type="button"
                    class="{EDITOR_TILE_IN_GROUP_DRAG_VISIBLE} {chromeDragSm} text-emerald-600 dark:text-emerald-300"
                    aria-label="Drag to reorder tile in group"
                    data-testid="editor-tile-drag-handle"
                  >
                    <GripVertical class="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div class="min-h-0 w-full min-w-0 flex-1 pt-0">
                    <TileEditChrome
                      tile={t}
                      onEdit={onEditTile}
                      showEditButton={editLayout}
                    >
                      {#snippet children()}
                        {@render tileContent(t)}
                      {/snippet}
                    </TileEditChrome>
                  </div>
                  {#if editLayout && onItemColSpanChange && rs === 1}
                    <TileColSpanResizeHandle
                      colSpan={T}
                      maxTracks={G}
                      trackCount={G}
                      onColSpanChange={(cs, phase) => onItemColSpanChange(t.id, cs, phase, group.id)}
                    />
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
          </div>
        {/if}
      {:else}
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
        >
          {#if isGroupEmpty}
            <div
              class="min-h-28 min-w-full flex-1 rounded-md border border-dashed border-gray-200/65 bg-gray-50/40 dark:border-gray-600 dark:bg-gray-900/30"
              use:droppable={{
                container: groupEmptyContainer(group.id),
                direction: "horizontal",
                callbacks: dropCb,
                attributes: dndDropAttrs,
              }}
              data-dnd-container={groupEmptyContainer(group.id)}
              data-testid="editor-group-nowrap-empty"
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
              {@const sub = c.item}
              {@const Gs = groupOuterColSpan(sub)}
              {@const wpx = G > 0 && nowrapAvailPort > 0 ? (nowrapAvailPort * Gs) / G : 0}
              {@const subList = getSubDndList(sub)}
              <div
                class="editor-nested-container-shell relative box-border flex max-w-none min-w-0 shrink-0 flex-col rounded-md border border-dashed border-gray-200/55 bg-white/35 [min-width:2.5rem] dark:border-gray-600/60 dark:bg-gray-900/35 {editorGroupInPlay(sub.id)
                  ? 'editor-surface-in-play'
                  : ''}"
                style="width: {wpx < 1 ? 120 : wpx}px; min-height: 6rem;"
                title={sub.id}
                data-testid="editor-nested-group"
                data-editor-group="true"
                data-tile-id={c.id}
                role="group"
                aria-label={`${nestedContainerDisplayTitle(sub.id)} (${sub.id}): drop plugins or add nested container`}
                use:droppable={{
                  container: groupChildSlotContainer(group.id, c.id),
                  direction: "horizontal",
                  callbacks: dropCb,
                  attributes: dndDropAttrs,
                }}
                data-dnd-container={groupChildSlotContainer(group.id, c.id)}
              >
                <div
                  class="pointer-events-auto"
                  data-editor-container-chrome
                  use:draggable={{
                    dragData: groupCellPayload(group.id, c.id),
                    container: groupChildSlotContainer(group.id, c.id),
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
                      <div
                        class="{EDITOR_PLUGIN_HOVER_SHELL} relative min-w-[5rem] shrink-0 rounded border border-dashed border-gray-200/45 bg-white/45 p-1 dark:border-gray-600/50 dark:bg-gray-900/30 {editorTileInPlay(nc.id)
                          ? 'editor-surface-in-play'
                          : ''}"
                        style="width: {subWpx < 1 ? 40 : subWpx}px;{effectiveRowSpan(t) > 1
                          ? ` min-height: ${Math.min(12, effectiveRowSpan(t)) * 2.25}rem;`
                          : ' min-height: 0;'}"
                        data-dashboard-editor="tile-row"
                        data-testid="editor-tile"
                        data-tile-id={nc.id}
                        use:draggable={{
                          dragData: groupCellPayload(sub.id, nc.id),
                          container: groupChildSlotContainer(sub.id, nc.id),
                          handle: TILE_HANDLE,
                          attributes: dndDragAttrs,
                        }}
                        use:droppable={{
                          container: groupChildSlotContainer(sub.id, nc.id),
                          direction: "horizontal",
                          callbacks: dropCb,
                          attributes: dndDropAttrs,
                        }}
                        data-dnd-container={groupChildSlotContainer(sub.id, nc.id)}
                      >
                        <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-0.5 pr-0.5" title={sub.id}>
                          {nestedContainerDisplayTitle(sub.id)}
                        </p>
                        <div class="relative min-h-0 w-full min-w-0 flex-1">
                          <button
                            type="button"
                            class="{EDITOR_TILE_IN_GROUP_DRAG_VISIBLE} {chromeDragSm} text-emerald-600 dark:text-emerald-300"
                            aria-label="Drag to reorder tile in nested container"
                            data-testid="editor-tile-drag-handle"
                          >
                            <GripVertical class="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <div class="min-h-0 w-full min-w-0 pt-0">
                            <TileEditChrome
                              tile={t}
                              onEdit={onEditTile}
                              showEditButton={editLayout}
                            >
                              {#snippet children()}
                                {@render tileContent(t)}
                              {/snippet}
                            </TileEditChrome>
                          </div>
                        </div>
                      </div>
                    {/if}
                  {/each}
                  {/if}
                </div>
              </div>
            {:else}
              {@const t = dndListItemToDashboardTile(c)}
              {@const T = effectiveColSpan(t)}
              {@const rs = effectiveRowSpan(t)}
              {@const wpx = G > 0 && nowrapAvailPort > 0 ? (nowrapAvailPort * T) / G : 0}
              <div
                class="{EDITOR_PLUGIN_HOVER_SHELL} relative z-[4] box-border flex max-w-none min-w-0 shrink-0 flex-col rounded border border-dashed border-gray-200/45 bg-white/40 [min-width:2.5rem] dark:border-gray-600/50 dark:bg-gray-900/20 {editorTileInPlay(c.id)
                  ? 'editor-surface-in-play'
                  : ''}"
                style="width: {wpx < 1 ? 40 : wpx}px;{rs > 1
                  ? ` min-height: ${Math.min(12, rs) * 2.25}rem;`
                  : ' min-height: 0;'}"
                data-dashboard-editor="tile-row"
                data-testid="editor-tile"
                data-tile-id={c.id}
                use:draggable={{
                  dragData: groupCellPayload(group.id, c.id),
                  container: groupChildSlotContainer(group.id, c.id),
                  handle: TILE_HANDLE,
                  attributes: dndDragAttrs,
                }}
                use:droppable={{
                  container: groupChildSlotContainer(group.id, c.id),
                  direction: "horizontal",
                  callbacks: dropCb,
                  attributes: dndDropAttrs,
                }}
                data-dnd-container={groupChildSlotContainer(group.id, c.id)}
              >
                <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-1 pr-1" title={group.id}>
                  {nestedContainerDisplayTitle(group.id)}
                </p>
                <div class="relative min-h-0 w-full min-w-0 flex-1">
                  <button
                    type="button"
                    class="{EDITOR_TILE_IN_GROUP_DRAG_VISIBLE} {chromeDragSm} text-emerald-600 dark:text-emerald-300"
                    aria-label="Drag to reorder tile in group"
                    data-testid="editor-tile-drag-handle"
                  >
                    <GripVertical class="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div class="min-h-0 w-full min-w-0 flex-1 pt-0">
                    <TileEditChrome
                      tile={t}
                      onEdit={onEditTile}
                      showEditButton={editLayout}
                    >
                      {#snippet children()}
                        {@render tileContent(t)}
                      {/snippet}
                    </TileEditChrome>
                  </div>
                  {#if editLayout && onItemColSpanChange && rs === 1}
                    <TileColSpanResizeHandle
                      colSpan={T}
                      maxTracks={G}
                      trackCount={G}
                      onColSpanChange={(cs, phase) => onItemColSpanChange(t.id, cs, phase, group.id)}
                    />
                  {/if}
                </div>
              </div>
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
