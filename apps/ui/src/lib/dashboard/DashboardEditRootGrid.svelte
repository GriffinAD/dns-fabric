<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { dndState, draggable, droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
  import {
    effectiveColSpan,
    effectiveRowSpan,
    GRID_COLUMNS,
    gridAreaStyle,
    gridColumnSpanStyle,
    groupOuterColSpan,
    rootEditGridColumnCount,
  } from "./gridPlacement";
  import {
    type DashboardDndListItem,
    dndListItemToDashboardTile,
    isDndCellGroup,
  } from "./groupDndFinalize";
  import {
    EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX,
    EDITOR_CHROME_TOP_OFFSET_PX,
    EDITOR_PLUGIN_CAPTION_BAR_CLASS,
    EDITOR_PLUGIN_HOVER_SHELL,
    EDITOR_PLUGIN_HOVER_VISIBLE,
    EDITOR_TILE_IN_GROUP_DRAG_VISIBLE,
    nestedContainerDisplayTitle,
  } from "./interactions/editorChrome";
  import type { DashboardDragPayload } from "./interactions/dashboardSveltedndTypes";
  import {
    groupCellPayload,
    groupAppendContainer,
    groupCanvasContainer,
    groupChildSlotContainer,
    groupEmptyContainer,
    groupGapAfterContainer,
    parseDragPayload,
    rootRowEndContainer,
    rootGapAfterContainer,
    rootCanvasContainer,
    rootAppendContainer,
    rootCellPayload,
    rootSlotContainer,
    ROOT_EMPTY_CONTAINER,
  } from "./interactions/dashboardSveltedndTypes";
  import { dedupeById } from "./layoutTree";
  import { DASHBOARD_STRIP_GAP_1_PX, DASHBOARD_STRIP_GAP_2_PX, flexStripDistributedWidth } from "./stripWidth";
  import TileColSpanResizeHandle from "./editor/TileColSpanResizeHandle.svelte";
  import TileEditChrome from "./TileEditChrome.svelte";
  import type { DashboardGroup, DashboardTile, RootLayoutItem } from "./types";

  /** Container shell grips only — must not match {@link TILE_HANDLE} or inner tile drags move the panel. */
  const CONTAINER_DND_HANDLE =
    '[data-testid="editor-container-drag-handle"],[data-testid="editor-nested-group-drag-handle"]';
  const TILE_HANDLE = '[data-testid="editor-tile-drag-handle"]';

  const dndDragAttrs = { draggingClass: "opacity-90 shadow-md rounded-md ring-2 ring-primary-500/35" };
  const dndDropAttrs = {
    dragOverClass:
      "svelte-dnd-drop-target outline outline-2 outline-dashed outline-offset-[3px] rounded-md outline-primary-500",
  };

  let {
    dndRoot,
    dndByGroup,
    rootPackedById,
    editorPointerDndActive,
    noWrapEditPortW,
    noWrapStripPortMeasure,
    chromeDragSm,
    chromeEditSm,
    onLayoutDrop,
    onDragOverLayout,
    onDragEndLayout,
    editorTileInPlay,
    editorGroupInPlay,
    onAddTileToGroup,
    onAddGroupToGroup,
    onEditGroup,
    editLayout,
    onEditTile,
    onItemColSpanChange,
    getSubDndList,
    tileContent,
  }: {
    dndRoot: DashboardDndListItem[];
    dndByGroup: Record<string, DashboardDndListItem[]>;
    rootPackedById: Map<string, RootLayoutItem>;
    editorPointerDndActive: boolean;
    noWrapEditPortW: Record<string, number>;
    noWrapStripPortMeasure: (el: HTMLDivElement, gid: string) => { destroy: () => void };
    chromeDragSm: string;
    chromeEditSm: string;
    onLayoutDrop: (state: DragDropState<DashboardDragPayload>) => void;
    onDragOverLayout: (state: DragDropState<DashboardDragPayload>) => void;
    onDragEndLayout: (state: DragDropState<DashboardDragPayload>) => void;
    editorTileInPlay: (id: string) => boolean;
    editorGroupInPlay: (id: string) => boolean;
    onAddTileToGroup?: (groupId: string, pluginId: string) => void;
    onAddGroupToGroup?: (parentGroupId: string) => void;
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
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  const dropCb = $derived.by(() => ({
    onDrop: onLayoutDrop,
    onDragOver: onDragOverLayout,
    onDragEnd: onDragEndLayout,
  }));

  const activeDragPayload = $derived.by((): DashboardDragPayload | null => {
    if (!editorPointerDndActive) return null;
    return parseDragPayload(dndState.draggedItem) ?? (dndState.draggedItem as DashboardDragPayload);
  });

  function dndRootRowForDrag(drag: DashboardDragPayload): DashboardDndListItem | undefined {
    if (drag.k !== "cr") return undefined;
    return dndRoot.find((d) => d.id === drag.i);
  }

  /** True when the pointer drag is a root-level **container** row (blue grip), not a dashboard tile. */
  function draggingRootContainer(drag: DashboardDragPayload): boolean {
    const row = dndRootRowForDrag(drag);
    return row != null && isDndCellGroup(row.item);
  }

  /** True when the pointer drag is a root-level **plugin tile** (green grip on the canvas). */
  function draggingRootPluginTile(drag: DashboardDragPayload): boolean {
    const row = dndRootRowForDrag(drag);
    return row != null && !isDndCellGroup(row.item);
  }

  /** Inner container canvas/gap/append — palette, in-panel tiles, or a root tile entering a panel. */
  function groupInnerSurfaceDragActive(): boolean {
    const drag = activeDragPayload;
    if (!editorPointerDndActive || !drag) return false;
    if (drag.k === "cg" || drag.k === "pp" || drag.k === "pg") return true;
    return drag.k === "cr" && draggingRootPluginTile(drag);
  }

  /** Root-grid overlay on a panel — only while repositioning that panel on the canvas. */
  function rootGroupGridDropActive(groupId: string): boolean {
    const drag = activeDragPayload;
    if (!editorPointerDndActive || !drag || drag.k !== "cr") return false;
    if (!draggingRootContainer(drag)) return false;
    return drag.i !== groupId;
  }

  /** Root tile hit targets — reorder on canvas or promote a panel child onto the root grid. */
  function rootPluginTileHitActive(): boolean {
    const drag = activeDragPayload;
    if (!editorPointerDndActive || !drag) return false;
    if (drag.k === "cg" || drag.k === "pp" || drag.k === "pg") return true;
    return drag.k === "cr";
  }

  type RootRowEndDropSlot = { key: string; row: number; startCol: number; span: number; targetId: string };
  type RootRowGapDropSlot = { key: string; row: number; startCol: number; span: number; afterId: string };

  const rootAppendGridRow = $derived.by((): number => {
    let maxEnd = 0;
    for (const d of dndRoot) {
      const grid = rootPackedById.get(d.id)?.grid;
      if (!grid) continue;
      maxEnd = Math.max(maxEnd, grid.row + (grid.rowSpan ?? 1));
    }
    return maxEnd + 1;
  });

  const rootRowGapDropSlots = $derived.by((): RootRowGapDropSlot[] => {
    const byRow = new Map<number, Array<{ id: string; col: number; end: number }>>();
    for (const d of dndRoot) {
      const grid = rootPackedById.get(d.id)?.grid;
      if (!grid || grid.rowSpan !== 1) continue;
      const row = grid.row;
      const list = byRow.get(row) ?? [];
      list.push({ id: d.id, col: grid.col, end: grid.col + grid.colSpan });
      byRow.set(row, list);
    }
    const out: RootRowGapDropSlot[] = [];
    for (const [row, tiles] of byRow) {
      tiles.sort((a, b) => a.col - b.col);
      for (let i = 0; i < tiles.length - 1; i++) {
        const a = tiles[i]!;
        const b = tiles[i + 1]!;
        if (b.col > a.end) {
          out.push({
            key: `gap:${a.id}:${b.id}`,
            row,
            startCol: a.end,
            span: b.col - a.end,
            afterId: a.id,
          });
        }
      }
    }
    return out;
  });

  const rootPackedItems = $derived(
    dndRoot
      .map((d) => rootPackedById.get(d.id))
      .filter((p): p is RootLayoutItem => p != null),
  );

  const rootGridColumnCount = $derived(
    rootEditGridColumnCount(rootPackedItems, { dragging: editorPointerDndActive }),
  );

  const rootGridMinWidthPercent = $derived(
    `${(rootGridColumnCount / GRID_COLUMNS) * 100}%`,
  );

  const rootRowEndDropSlots = $derived.by((): RootRowEndDropSlot[] => {
    const cols = rootGridColumnCount;
    const byRow = new Map<number, { endExclusive: number; targetId: string }>();
    for (const d of dndRoot) {
      const placed = rootPackedById.get(d.id);
      const grid = placed?.grid;
      if (!grid) continue;
      const row = Math.max(0, grid.row);
      const endExclusive = Math.max(1, grid.col + grid.colSpan);
      const prev = byRow.get(row);
      if (!prev || endExclusive > prev.endExclusive) {
        byRow.set(row, { endExclusive, targetId: d.id });
      }
    }
    return [...byRow.entries()]
      .filter(([, v]) => v.endExclusive < cols)
      .map(([row, v]) => ({
        key: `r:${row}:end:${v.targetId}`,
        row,
        startCol: v.endExclusive,
        span: cols - v.endExclusive,
        targetId: v.targetId,
      }));
  });
</script>

<!-- Root edit chrome + 20-column drop zone; state lives in DashboardHost. -->
<div
  class="relative min-h-[120px] max-w-full overflow-x-auto overflow-y-hidden rounded-lg border-2 border-dashed border-slate-300/95 dark:border-gray-600"
  data-dashboard-editor="grid-chrome"
  data-testid="editor-grid-chrome"
  data-editor-pointer-dnd={editorPointerDndActive ? "true" : "false"}
  data-editor-invalid-drop={dndState.invalidDrop ? "true" : "false"}
  role="region"
  aria-label="Drop plugins or a new container onto the grid"
  style="--editor-chrome-button-offset: {EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX}px; --editor-chrome-top: {EDITOR_CHROME_TOP_OFFSET_PX}px;"
>
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
        {#each dndRoot as d, i (d.id)}
          {@const placed = rootPackedById.get(d.id)}
          {@const g = isDndCellGroup(d.item) ? d.item : null}
          {@const cv = !isDndCellGroup(d.item) ? (d.item as DashboardTile) : null}
          {#if g}
            {@const gItems = dedupeById(dndByGroup[g.id] ?? [])}
            {@const isGroupEmpty = gItems.length === 0}
            {@const G = groupOuterColSpan(g)}
            <div
              class="editor-root-container-shell relative z-[2] flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch rounded-md border border-slate-200/70 bg-transparent pt-2 pb-2 dark:border-gray-500/30 {editorGroupInPlay(g.id)
                ? 'editor-surface-in-play'
                : ''}"
              style={placed?.grid ? gridAreaStyle(placed.grid) : ""}
              data-dashboard-editor="tile-row"
              data-testid="editor-tile"
              data-tile-id={d.id}
              data-editor-group="true"
              role="group"
              aria-label="Container {g.id}: drop plugins here or drag the grip to move"
            >
              <div
                class="editor-container-chrome-rail pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-8 items-start"
              >
                <div
                  class="pointer-events-auto"
                  data-editor-container-chrome
                  use:draggable={{
                    dragData: rootCellPayload(d.id),
                    container: rootSlotContainer(d.id),
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
                    onclick={() => onEditGroup(g)}
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
                  onColSpanChange={(cs, phase) => onItemColSpanChange(g.id, cs, phase)}
                />
              {/if}
              {#if rootGroupGridDropActive(g.id)}
                <div
                  class="editor-group-root-grid-drop editor-group-root-hit-active pointer-events-auto absolute inset-0 z-[45] rounded-md"
                  aria-hidden="true"
                  use:droppable={{
                    container: rootSlotContainer(d.id),
                    direction: "grid",
                    callbacks: dropCb,
                    attributes: dndDropAttrs,
                  }}
                data-dnd-container={rootSlotContainer(d.id)}
                ></div>
              {/if}
              <div
                class="editor-group-inner relative z-[2] min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-md pl-0 pt-8 {rootGroupGridDropActive(g.id)
                  ? 'pointer-events-none'
                  : ''}"
                data-editor-group-inner="true"
                role="region"
                aria-label="Container {g.id}: drop plugins or reorder tiles"
              >
                <div class="relative w-full min-h-0 flex-1" class:min-h-28={isGroupEmpty}>
                  {#if g.innerWrap === true}
                    {#if isGroupEmpty}
                      <div
                        class="flex min-h-28 w-full flex-wrap content-start items-stretch gap-2 rounded-md border border-dashed border-gray-200/65 bg-gray-50/40 dark:border-gray-600 dark:bg-gray-900/30"
                        use:droppable={{
                          container: groupEmptyContainer(g.id),
                          callbacks: dropCb,
                          attributes: dndDropAttrs,
                        }}
                        data-dnd-container={groupEmptyContainer(g.id)}
                        data-testid="editor-group-inner-empty"
                      ></div>
                    {:else}
                      <div
                        class="relative flex h-full min-h-0 w-full min-w-0 flex-wrap content-start items-stretch gap-2"
                        use:droppable={{
                          container: groupEmptyContainer(g.id),
                          callbacks: dropCb,
                          attributes: dndDropAttrs,
                        }}
                      data-dnd-container={groupEmptyContainer(g.id)}
                      >
                        <div
                          class="editor-group-canvas-drop editor-root-canvas-drop absolute inset-0 z-0 min-h-full rounded-md {groupInnerSurfaceDragActive()
                            ? 'pointer-events-auto'
                            : 'pointer-events-none'}"
                          use:droppable={{
                            container: groupCanvasContainer(g.id),
                            callbacks: dropCb,
                            attributes: dndDropAttrs,
                          }}
                          data-dnd-container={groupCanvasContainer(g.id)}
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
                              container: groupGapAfterContainer(g.id, gItems[gi - 1]!.id),
                              callbacks: dropCb,
                              attributes: dndDropAttrs,
                            }}
                            data-dnd-container={groupGapAfterContainer(g.id, gItems[gi - 1]!.id)}
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
                              dragData: groupCellPayload(g.id, c.id),
                              container: groupChildSlotContainer(g.id, c.id),
                              handle: TILE_HANDLE,
                              attributes: dndDragAttrs,
                            }}
                            use:droppable={{
                              container: groupChildSlotContainer(g.id, c.id),
                              direction: "horizontal",
                              callbacks: dropCb,
                              attributes: dndDropAttrs,
                            }}
                            data-dnd-container={groupChildSlotContainer(g.id, c.id)}
                          >
                            <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-1 pr-1" title={g.id}>
                              {nestedContainerDisplayTitle(g.id)}
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
                                  onColSpanChange={(cs, phase) => onItemColSpanChange(t.id, cs, phase, g.id)}
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
                      use:noWrapStripPortMeasure={g.id}
                      use:droppable={{
                        container: groupEmptyContainer(g.id),
                        direction: "horizontal",
                        callbacks: dropCb,
                        attributes: dndDropAttrs,
                      }}
                    data-dnd-container={groupEmptyContainer(g.id)}
                    >
                      {#if isGroupEmpty}
                        <div
                          class="min-h-28 min-w-full flex-1 rounded-md border border-dashed border-gray-200/65 bg-gray-50/40 dark:border-gray-600 dark:bg-gray-900/30"
                          use:droppable={{
                            container: groupEmptyContainer(g.id),
                            direction: "horizontal",
                            callbacks: dropCb,
                            attributes: dndDropAttrs,
                          }}
                          data-dnd-container={groupEmptyContainer(g.id)}
                          data-testid="editor-group-nowrap-empty"
                        ></div>
                      {:else}
                        <div
                          class="editor-group-canvas-drop editor-root-canvas-drop absolute inset-0 z-0 min-h-full shrink-0 rounded-md {groupInnerSurfaceDragActive()
                            ? 'pointer-events-auto'
                            : 'pointer-events-none'}"
                          use:droppable={{
                            container: groupCanvasContainer(g.id),
                            direction: "horizontal",
                            callbacks: dropCb,
                            attributes: dndDropAttrs,
                          }}
                          data-dnd-container={groupCanvasContainer(g.id)}
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
                              container: groupGapAfterContainer(g.id, gItems[gi - 1]!.id),
                              direction: "horizontal",
                              callbacks: dropCb,
                              attributes: dndDropAttrs,
                            }}
                            data-dnd-container={groupGapAfterContainer(g.id, gItems[gi - 1]!.id)}
                            data-editor-group-surface-drop="true"
                            aria-hidden="true"
                          ></div>
                        {/if}
                        {@const nowrapAvailPort = flexStripDistributedWidth(
                          noWrapEditPortW[g.id] ?? 0,
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
                              container: groupChildSlotContainer(g.id, c.id),
                              direction: "horizontal",
                              callbacks: dropCb,
                              attributes: dndDropAttrs,
                            }}
                            data-dnd-container={groupChildSlotContainer(g.id, c.id)}
                          >
                            <div
                              class="pointer-events-auto"
                              data-editor-container-chrome
                              use:draggable={{
                                dragData: groupCellPayload(g.id, c.id),
                                container: groupChildSlotContainer(g.id, c.id),
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
                              dragData: groupCellPayload(g.id, c.id),
                              container: groupChildSlotContainer(g.id, c.id),
                              handle: TILE_HANDLE,
                              attributes: dndDragAttrs,
                            }}
                            use:droppable={{
                              container: groupChildSlotContainer(g.id, c.id),
                              direction: "horizontal",
                              callbacks: dropCb,
                              attributes: dndDropAttrs,
                            }}
                            data-dnd-container={groupChildSlotContainer(g.id, c.id)}
                          >
                            <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-1 pr-1" title={g.id}>
                              {nestedContainerDisplayTitle(g.id)}
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
                                  onColSpanChange={(cs, phase) => onItemColSpanChange(t.id, cs, phase, g.id)}
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
                            container: groupAppendContainer(g.id),
                            direction: "horizontal",
                            callbacks: dropCb,
                            attributes: dndDropAttrs,
                          }}
                          data-dnd-container={groupAppendContainer(g.id)}
                          data-editor-group-surface-drop="true"
                          data-testid="editor-group-append-drop"
                          aria-hidden="true"
                        ></div>
                      {/if}
                    </div>
                  {/if}
                  {#if isGroupEmpty && g.innerWrap === true}
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
          {:else if cv}
            <div
              class="{EDITOR_PLUGIN_HOVER_SHELL} relative z-[2] flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch rounded-md border border-slate-200/80 bg-white dark:border-gray-700 dark:bg-gray-800 {editorTileInPlay(d.id)
                ? 'editor-surface-in-play'
                : ''}"
              style={placed?.grid ? gridAreaStyle(placed.grid) : gridColumnSpanStyle(cv)}
              data-dashboard-editor="tile-row"
              data-testid="editor-tile"
              data-tile-id={d.id}
              use:draggable={{
                dragData: rootCellPayload(d.id),
                container: rootSlotContainer(d.id),
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
                  container: rootSlotContainer(d.id),
                  direction: "grid",
                  callbacks: dropCb,
                  attributes: dndDropAttrs,
                }}
              data-dnd-container={rootSlotContainer(d.id)}
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
                    tile={cv}
                    onEdit={onEditTile}
                    showEditButton={editLayout}
                  >
                    {#snippet children()}
                      {@render tileContent(cv)}
                    {/snippet}
                  </TileEditChrome>
                </div>
                {#if editLayout && onItemColSpanChange && placed?.kind === "tile" && placed.grid?.rowSpan === 1}
                  <TileColSpanResizeHandle
                    colSpan={effectiveColSpan(cv)}
                    maxTracks={20}
                    trackCount={20}
                    onColSpanChange={(cs, phase) => onItemColSpanChange(cv.id, cs, phase)}
                  />
                {/if}
              </div>
            </div>
          {/if}
        {/each}
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
    </div>
