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
    gridColumnSpanStyle,
    groupOuterColSpan,
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
    nestedContainerDisplayTitle,
  } from "./interactions/editorChrome";
  import type { DashboardDragPayload } from "./interactions/dashboardSveltedndTypes";
  import {
    groupCellPayload,
    groupChildSlotContainer,
    groupEmptyContainer,
    rootRowEndContainer,
    rootCellPayload,
    rootSlotContainer,
    ROOT_EMPTY_CONTAINER,
  } from "./interactions/dashboardSveltedndTypes";
  import { dedupeById } from "./layoutTree";
  import { DASHBOARD_STRIP_GAP_1_PX, DASHBOARD_STRIP_GAP_2_PX, flexStripDistributedWidth } from "./stripWidth";
  import TileEditChrome from "./TileEditChrome.svelte";
  import type { DashboardGroup, DashboardTile, RootLayoutItem } from "./types";

  /** Grips that start a drag (root tile, root group, nested group shell). */
  const DND_HANDLE = '[data-testid="editor-tile-drag-handle"],[data-testid="editor-nested-group-drag-handle"]';
  const TILE_HANDLE = '[data-testid="editor-tile-drag-handle"]';

  const dndDragAttrs = { draggingClass: "opacity-90 shadow-md rounded-md ring-2 ring-primary-500/35" };
  const dndDropAttrs = {
    dragOverClass: "outline outline-2 outline-dashed outline-offset-[3px] rounded-md outline-primary-500",
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
    editorTileInPlay,
    editorGroupInPlay,
    onAddTileToGroup,
    onAddGroupToGroup,
    onEditGroup,
    editLayout,
    onEditTile,
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
    editorTileInPlay: (id: string) => boolean;
    editorGroupInPlay: (id: string) => boolean;
    onAddTileToGroup?: (groupId: string, pluginId: string) => void;
    onAddGroupToGroup?: (parentGroupId: string) => void;
    onEditGroup?: (g: DashboardGroup) => void;
    editLayout: boolean;
    onEditTile?: (tile: DashboardTile) => void;
    getSubDndList: (group: DashboardGroup) => DashboardDndListItem[];
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  const dropCb = $derived.by(() => ({ onDrop: onLayoutDrop, onDragOver: onDragOverLayout }));

  type RootRowEndDropSlot = { key: string; row: number; startCol: number; span: number; targetId: string };
  const rootRowEndDropSlots = $derived.by((): RootRowEndDropSlot[] => {
    const byRow = new Map<number, { endExclusive: number; targetId: string }>();
    for (const d of dndRoot) {
      const placed = rootPackedById.get(d.id);
      const grid = placed?.grid;
      if (!grid) continue;
      const row = Math.max(0, grid.row);
      const endExclusive = Math.min(20, Math.max(1, grid.col + grid.colSpan));
      const prev = byRow.get(row);
      if (!prev || endExclusive > prev.endExclusive) {
        byRow.set(row, { endExclusive, targetId: d.id });
      }
    }
    return [...byRow.entries()]
      .filter(([, v]) => v.endExclusive < 20)
      .map(([row, v]) => ({
        key: `r:${row}:end:${v.targetId}`,
        row,
        startCol: v.endExclusive,
        span: 20 - v.endExclusive,
        targetId: v.targetId,
      }));
  });
</script>

<!-- Root edit chrome + 20-column drop zone; state lives in DashboardHost. -->
<div
  class="relative min-h-[120px] overflow-hidden rounded-lg border-2 border-dashed border-slate-300/95 dark:border-gray-600"
  data-dashboard-editor="grid-chrome"
  data-testid="editor-grid-chrome"
  data-editor-pointer-dnd={editorPointerDndActive ? "true" : "false"}
  role="region"
  aria-label="Drop plugins or a new container onto the grid"
  style="--editor-chrome-button-offset: {EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX}px; --editor-chrome-top: {EDITOR_CHROME_TOP_OFFSET_PX}px;"
>
      <div
        class="relative grid min-h-[120px] w-full auto-rows-[minmax(0,auto)] grid-cols-[repeat(20,minmax(0,1fr))] content-start place-items-stretch pb-[min(50vh,40rem)]"
        data-dashboard-editor="drop-zone"
        data-testid="editor-drop-zone"
        role="group"
        aria-label="Dashboard tile grid"
      >
        {#if dndRoot.length === 0}
          <div
            class="col-span-20 min-h-28 rounded-md border border-dashed border-slate-200/70 bg-slate-50/40 dark:border-gray-600 dark:bg-gray-900/25"
            use:droppable={{
              container: ROOT_EMPTY_CONTAINER,
              callbacks: dropCb,
              attributes: dndDropAttrs,
            }}
            data-testid="editor-root-empty-drop"
            aria-label="Empty dashboard — drop a tile here"
          ></div>
        {/if}
        {#each rootRowEndDropSlots as slot (slot.key)}
          <div
            class="min-h-[2.25rem] rounded-md border border-dashed border-transparent"
            style="grid-column: {slot.startCol + 1} / span {slot.span}; grid-row: {slot.row + 1} / span 1;"
            use:droppable={{
              container: rootRowEndContainer(slot.targetId),
              callbacks: dropCb,
            }}
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
              class="editor-root-container-shell relative flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch rounded-md border border-slate-200/70 bg-transparent pt-2 pb-2 shadow-[-2px_5px_14px_-3px_rgba(15,23,42,0.07),0_1px_1px_0_rgba(15,23,42,0.04)] dark:border-gray-500/30 dark:shadow-[-2px_6px_20px_-4px_rgba(0,0,0,0.45)] {editorGroupInPlay(g.id)
                ? 'editor-surface-in-play'
                : ''}"
              style={placed?.grid ? gridAreaStyle(placed.grid) : ""}
              data-dashboard-editor="tile-row"
              data-testid="editor-tile"
              data-tile-id={d.id}
              data-editor-group="true"
              role="group"
              aria-label="Container {g.id}: drop plugins here or drag the grip to move"
              use:draggable={{
                dragData: rootCellPayload(d.id),
                container: rootSlotContainer(d.id),
                handle: DND_HANDLE,
                attributes: dndDragAttrs,
              }}
              use:droppable={{
                container: rootSlotContainer(d.id),
                callbacks: dropCb,
                attributes: dndDropAttrs,
              }}
            >
              <!-- Anchor container chrome to the shell (selection outline), not the padded inner wrapper. -->
              <button
                type="button"
                class="{chromeDragSm} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
                aria-label="Drag to move group on dashboard"
                data-testid="editor-tile-drag-handle"
                data-editor-container-chrome
              >
                <GripVertical class="h-5 w-5" aria-hidden="true" />
              </button>
              {#if editLayout && onEditGroup}
                <button
                  type="button"
                  class="{chromeEditSm} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
                  aria-label="Edit container placement"
                  data-testid="editor-group-edit"
                  data-editor-container-chrome
                  onpointerdown={(e) => e.stopPropagation()}
                  onclick={() => onEditGroup(g)}
                >
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                </button>
              {/if}
              <div
                class="min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-md pl-0 pt-0"
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
                        data-testid="editor-group-inner-empty"
                      ></div>
                    {:else}
                      <div
                        class="flex h-full min-h-0 w-full min-w-0 flex-wrap content-start items-stretch gap-2"
                        use:droppable={{
                          container: groupEmptyContainer(g.id),
                          callbacks: dropCb,
                          attributes: dndDropAttrs,
                        }}
                      >
                      {#each gItems as c (c.id)}
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
                            class="{EDITOR_PLUGIN_HOVER_SHELL} relative box-border flex min-h-0 max-w-full min-w-0 flex-col rounded border border-dashed border-gray-200/45 bg-white/40 dark:border-gray-600/50 dark:bg-gray-900/20 {editorTileInPlay(c.id)
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
                              callbacks: dropCb,
                              attributes: dndDropAttrs,
                            }}
                          >
                            <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-1 pr-1" title={g.id}>
                              {nestedContainerDisplayTitle(g.id)}
                            </p>
                            <div class="relative min-h-0 w-full min-w-0 flex-1">
                              <button
                                type="button"
                                class="{EDITOR_PLUGIN_HOVER_VISIBLE} {chromeDragSm} text-emerald-600 dark:text-emerald-300"
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
                            </div>
                          </div>
                        {/if}
                      {/each}
                      </div>
                    {/if}
                  {:else}
                    <div
                      class="h-full w-full min-h-0 min-w-0 max-w-full overflow-x-auto overflow-y-hidden flex min-w-0 max-w-full flex-nowrap content-start items-stretch gap-2 {isGroupEmpty
                        ? 'min-h-28'
                        : ''}"
                      use:noWrapStripPortMeasure={g.id}
                      use:droppable={{
                        container: groupEmptyContainer(g.id),
                        direction: "horizontal",
                        callbacks: dropCb,
                        attributes: dndDropAttrs,
                      }}
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
                          data-testid="editor-group-nowrap-empty"
                        ></div>
                      {:else}
                      {#each gItems as c (c.id)}
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
                            use:draggable={{
                              dragData: groupCellPayload(g.id, c.id),
                              container: groupChildSlotContainer(g.id, c.id),
                              handle: DND_HANDLE,
                              attributes: dndDragAttrs,
                            }}
                            use:droppable={{
                              container: groupChildSlotContainer(g.id, c.id),
                              direction: "horizontal",
                              callbacks: dropCb,
                              attributes: dndDropAttrs,
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
                                    use:draggable={{
                                      dragData: groupCellPayload(sub.id, nc.id),
                                      container: groupChildSlotContainer(sub.id, nc.id),
                                      handle: DND_HANDLE,
                                      attributes: dndDragAttrs,
                                    }}
                                    use:droppable={{
                                      container: groupChildSlotContainer(sub.id, nc.id),
                                      direction: "horizontal",
                                      callbacks: dropCb,
                                      attributes: dndDropAttrs,
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
                                  >
                                    <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-0.5 pr-0.5" title={sub.id}>
                                      {nestedContainerDisplayTitle(sub.id)}
                                    </p>
                                    <div class="relative min-h-0 w-full min-w-0 flex-1">
                                      <button
                                        type="button"
                                        class="{EDITOR_PLUGIN_HOVER_VISIBLE} {chromeDragSm} text-emerald-600 dark:text-emerald-300"
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
                            class="{EDITOR_PLUGIN_HOVER_SHELL} relative box-border flex max-w-none min-w-0 shrink-0 flex-col rounded border border-dashed border-gray-200/45 bg-white/40 [min-width:2.5rem] dark:border-gray-600/50 dark:bg-gray-900/20 {editorTileInPlay(c.id)
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
                          >
                            <p class="{EDITOR_PLUGIN_CAPTION_BAR_CLASS} pl-1 pr-1" title={g.id}>
                              {nestedContainerDisplayTitle(g.id)}
                            </p>
                            <div class="relative min-h-0 w-full min-w-0 flex-1">
                              <button
                                type="button"
                                class="{EDITOR_PLUGIN_HOVER_VISIBLE} {chromeDragSm} text-emerald-600 dark:text-emerald-300"
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
                            </div>
                          </div>
                        {/if}
                      {/each}
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
              class="{EDITOR_PLUGIN_HOVER_SHELL} relative flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch rounded-md border border-slate-200/80 bg-white dark:border-gray-700 dark:bg-gray-800 {editorTileInPlay(d.id)
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
              use:droppable={{
                container: rootSlotContainer(d.id),
                callbacks: dropCb,
                attributes: dndDropAttrs,
              }}
            >
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
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
