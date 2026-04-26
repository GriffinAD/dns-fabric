<script lang="ts">
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import {
    dragHandle,
    dragHandleZone,
    FEATURE_FLAG_NAMES,
    setFeatureFlag,
    SOURCES,
  } from "svelte-dnd-action";
  import type { DndEvent } from "svelte-dnd-action";

  setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, true);

  import type { PluginEntry } from "../api/types";
  import { DataGateway } from "../dataGateway";
  import PluginPalette from "../palette/PluginPalette.svelte";
  import { parsePaletteDrop, setPaletteAddGroupDragData, setPalettePluginDragData } from "../palette/paletteDragCodec";
  import { getFeatureFlag } from "../platform/featureFlags";
  import {
    effectiveColSpan,
    effectiveRowSpan,
    gridAreaStyle,
    gridColumnSpanStyle,
    groupGridAreaStyle,
    groupGridColumnSpanStyle,
    groupOuterColSpan,
    packGroupChildrenRowWrapInOrder,
    reorderRootLayoutItemsPreservingSlotOrigins,
    reorderTilesPreservingSlotOrigins,
  } from "./gridPlacement";
  import DashboardReadNestedHost from "./DashboardReadNestedHost.svelte";
  import GroupReadNoWrap from "./GroupReadNoWrap.svelte";
  import PluginTileMount from "./PluginTileMount.svelte";
  import TileEditChrome from "./TileEditChrome.svelte";
  import {
    buildRootLayoutFromDnd,
    type DashboardDndListItem,
    isDndCellGroup,
  } from "./groupDndFinalize";
  import {
    applyDashboardDragLift,
    dashboardEditorDropTargetStyle,
    dashboardEditorNestedFlipMs,
    dashboardEditorRootFlipMs,
    readPrefersReducedMotion,
  } from "./interactions/dndEditorFeedback";
  import { dedupeById } from "./layoutTree";
  import { stripScrollportObserve } from "./stripWidth";
  import type {
    DashboardGroup,
    DashboardLayout,
    DashboardLayoutV3,
    DashboardTile,
    GroupChild,
    RootLayoutItem,
  } from "./types";
  import { isDashboardGroupNode } from "./types";

  /** svelte-dnd-action zone type — one shared value so root ↔ container moves are allowed. */
  const SVELTE_DND_TYPE_DASHBOARD = "dashboard-layout";
  type DndListItem = DashboardDndListItem;

  let {
    layout,
    gateway,
    onEditTile,
    onEditGroup,
    editLayout = false,
    plugins = [] as PluginEntry[],
    onAddTile,
    onAddGroup,
    onAddTileToGroup,
    onLayoutStructureChange,
    onDeleteRootItem,
    onDeleteGroupChildTile,
    onPerfTileGridHint,
  }: {
    layout: DashboardLayoutV3;
    gateway: DataGateway;
    onEditTile?: (tile: DashboardTile) => void;
    onEditGroup?: (g: DashboardGroup) => void;
    editLayout?: boolean;
    plugins?: PluginEntry[];
    onAddTile?: (pluginId: string) => void;
    /** Add a new empty container (group) on the root grid; drag the grip to move it. */
    onAddGroup?: () => void;
    /** Drop a plugin from the palette onto a container in edit mode. */
    onAddTileToGroup?: (groupId: string, pluginId: string) => void;
    onLayoutStructureChange?: (next: DashboardLayout) => void;
    /** Remove a root tile or an entire container (and its child tiles). */
    onDeleteRootItem?: (itemId: string) => void;
    /** Remove one tile from inside a container. */
    onDeleteGroupChildTile?: (groupId: string, tileId: string) => void;
    onPerfTileGridHint?: (tileId: string, hint: { colSpan: number; rowSpan: number }) => void;
  } = $props();

  let dndRoot = $state<DndListItem[]>([]);
  let dndByGroup = $state<Record<string, DndListItem[]>>({});

  function rootItemToDnd(it: RootLayoutItem): DndListItem {
    return { id: it.id, item: it };
  }

  function groupChildToDnd(c: GroupChild): DndListItem {
    return { id: c.id, item: c };
  }

  function dndListItemToDashboardTile(c: DndListItem): DashboardTile {
    if (isDndCellGroup(c.item)) {
      throw new Error("expected a tile in group DnD list");
    }
    const { kind: _k, ...tile } = c.item as DashboardTile & { kind?: "tile" };
    return tile as DashboardTile;
  }

  function registerGroupDndTargets(children: GroupChild[], into: Record<string, DndListItem[]>) {
    for (const c of children) {
      if (isDashboardGroupNode(c)) {
        into[c.id] = dedupeById(c.children).map((ch) => groupChildToDnd(ch));
        registerGroupDndTargets(c.children, into);
      }
    }
  }

  $effect(() => {
    dndRoot = layout.items.map((it) => rootItemToDnd(it));
    const next: Record<string, DndListItem[]> = {};
    for (const it of layout.items) {
      if (it.kind === "group") {
        next[it.id] = dedupeById(it.children).map((ch) => groupChildToDnd(ch));
        registerGroupDndTargets(it.children, next);
      }
    }
    dndByGroup = next;
  });

  /** Merges per-group DnD lists with root so packed preview matches in-flight cross-zone drags. */
  function buildLayoutFromDnd(): RootLayoutItem[] {
    return buildRootLayoutFromDnd(layout.items, dndRoot, dndByGroup);
  }

  function commitDndToLayout() {
    const next = reorderRootLayoutItemsPreservingSlotOrigins(layout.items, buildLayoutFromDnd());
    onLayoutStructureChange?.({ version: 3, items: next });
  }

  const packedRoot = $derived(
    reorderRootLayoutItemsPreservingSlotOrigins(layout.items, buildLayoutFromDnd()),
  );
  const rootPackedById = $derived(new Map(packedRoot.map((it) => [it.id, it])));

  /** Rely on `enabled` only: some API responses omit `ui_dashboard` and would hide the whole palette. */
  const palette = $derived(plugins.filter((p) => p.enabled));

  /** Phase 7: honour `prefers-reduced-motion` for root FLIP only; nested zones stay at 0 ms. */
  let reducedMotion = $state(readPrefersReducedMotion());
  $effect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      reducedMotion = mq.matches;
    };
    reducedMotion = mq.matches;
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  const rootFlipMs = $derived(dashboardEditorRootFlipMs(reducedMotion));
  const editorDropTargetStyle = dashboardEditorDropTargetStyle();

  /** True while a pointer-driven in-grid drag is in flight (consider…finalize). For tests + subtle chrome. */
  let editorPointerDndActive = $state(false);

  function dashboardEditorTransformDragged(element?: HTMLElement, _data?: unknown, _index?: number) {
    applyDashboardDragLift(element, reducedMotion);
  }

  type DndConsiderFinalize = CustomEvent<DndEvent<DndListItem>>;

  /** Viewport width for an editor “strip” (Auto wrap off) — same math as `GroupReadNoWrap` widthPx. */
  let noWrapEditPortW = $state<Record<string, number>>({});
  function noWrapStripPortMeasure(el: HTMLDivElement, gid: string) {
    return stripScrollportObserve(el, (w) => {
      noWrapEditPortW = { ...noWrapEditPortW, [gid]: w };
    });
  }

  /**
   * Read view, Auto wrap off: a **single** horizontal scroller, not one strip per `grid.row`.
   * Splitting by row made multi-row grid data look like wrapped flex; order follows row then col.
   */
  function noWrapReadRowGroups(tiles: DashboardTile[]): DashboardTile[][] {
    if (tiles.length === 0) return [];
    const unique = dedupeById(tiles);
    const sorted = [...unique].sort(
      (a, b) =>
        (a.grid?.row ?? 0) - (b.grid?.row ?? 0) || (a.grid?.col ?? 0) - (b.grid?.col ?? 0),
    );
    return [sorted];
  }

  function handleRootConsider(e: DndConsiderFinalize) {
    if (e.detail.info.source === SOURCES.POINTER) editorPointerDndActive = true;
    dndRoot = dedupeById(e.detail.items);
  }

  function handleRootFinalize(e: DndConsiderFinalize) {
    editorPointerDndActive = false;
    dndRoot = dedupeById(e.detail.items);
    queueMicrotask(() => {
      if (!onLayoutStructureChange) return;
      commitDndToLayout();
    });
  }

  function handleGroupConsider(gid: string) {
    return (e: DndConsiderFinalize) => {
      if (e.detail.info.source === SOURCES.POINTER) editorPointerDndActive = true;
      const items = dedupeById(e.detail.items);
      dndByGroup = { ...dndByGroup, [gid]: items };
    };
  }

  function handleGroupFinalize(gid: string) {
    return (e: DndConsiderFinalize) => {
      editorPointerDndActive = false;
      const items = dedupeById(e.detail.items);
      dndByGroup = { ...dndByGroup, [gid]: items };
      queueMicrotask(() => {
        if (!onLayoutStructureChange) return;
        commitDndToLayout();
      });
    };
  }

  function onCanvasDrop(e: DragEvent) {
    e.preventDefault();
    const p = parsePaletteDrop(e.dataTransfer);
    if (p?.kind === "group") {
      onAddGroup?.();
      return;
    }
    if (p?.kind === "plugin") onAddTile?.(p.id);
  }

  /** Keep HTML5 drop off the `use:dragHandleZone` node (same element breaks native drop in practice). */
  function onEditorChromeDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onGroupPluginDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onGroupPluginDrop(e: DragEvent, groupId: string) {
    e.preventDefault();
    const p = parsePaletteDrop(e.dataTransfer);
    if (p?.kind === "plugin") {
      e.stopPropagation();
      onAddTileToGroup?.(groupId, p.id);
    }
  }
</script>

{#snippet renderTile(tile: DashboardTile, _inGroup: boolean)}
  <PluginTileMount
    {gateway}
    {tile}
    {plugins}
    {editLayout}
    {onEditTile}
    {onPerfTileGridHint}
  />
{/snippet}

<div class="flex flex-col gap-4" data-testid="dashboard-host">
  {#if editLayout && (palette.length > 0 || onAddGroup)}
    {#if getFeatureFlag("ui.palette.v2")}
      <PluginPalette {plugins} {onAddTile} {onAddGroup} />
    {:else}
      <div
        class="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/50"
        data-testid="layout-edit-palette"
        aria-label="Add dashboard plugins"
      >
        <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">
          <strong>Containers:</strong> use <span class="font-mono">Add container</span> or drag it onto the grid, then
          <strong>drag the grip (⋮⋮)</strong> on the group card to move the whole container. <strong>Tiles:</strong> drag
          a plugin chip to the grid or <strong>into a container</strong>. <strong>Reorder</strong> root tiles and tiles
          inside a container with their grips. Use the pencil to resize and configure.
        </p>
        <div class="flex flex-wrap gap-2">
          {#if onAddGroup}
            <button
              type="button"
              draggable="true"
              class="cursor-grab select-none rounded-lg border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:bg-primary-500 dark:hover:bg-primary-600"
              data-testid="layout-add-container"
              ondragstart={(e: DragEvent) => setPaletteAddGroupDragData(e)}
              onclick={() => onAddGroup?.()}
            >
              Add container
            </button>
          {/if}
          {#each palette as p (p.id)}
            <button
              type="button"
              draggable="true"
              class="cursor-grab select-none rounded-lg border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:bg-primary-500 dark:hover:bg-primary-600"
              ondragstart={(e: DragEvent) => setPalettePluginDragData(e, p.id)}
              onclick={() => onAddTile?.(p.id)}
            >
              Add {p.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/if}

  {#if editLayout}
    <div
      class="relative min-h-[120px] overflow-hidden rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600"
      data-testid="editor-grid-chrome"
      data-editor-pointer-dnd={editorPointerDndActive ? "true" : "false"}
      role="region"
      aria-label="Drop plugins or a new container onto the grid"
      ondragover={onEditorChromeDragOver}
      ondrop={onCanvasDrop}
    >
      <div
        class="relative grid min-h-[120px] w-full auto-rows-[minmax(0,auto)] grid-cols-[repeat(20,minmax(0,1fr))] content-start place-items-stretch pb-[min(50vh,40rem)]"
        data-testid="editor-drop-zone"
        role="group"
        aria-label="Dashboard tile grid"
        use:dragHandleZone={{
          items: dndRoot,
          flipDurationMs: rootFlipMs,
          type: SVELTE_DND_TYPE_DASHBOARD,
          autoAriaDisabled: true,
          morphDisabled: true,
          dropTargetStyle: editorDropTargetStyle,
          transformDraggedElement: dashboardEditorTransformDragged,
        }}
        onconsider={handleRootConsider}
        onfinalize={handleRootFinalize}
      >
        {#each dndRoot as d (d.id)}
          {@const placed = rootPackedById.get(d.id)}
          {@const g = isDndCellGroup(d.item) ? d.item : null}
          {@const cv = !isDndCellGroup(d.item) ? (d.item as DashboardTile) : null}
          {#if g}
            {@const gItems = dedupeById(dndByGroup[g.id] ?? [])}
            {@const isGroupEmpty = gItems.length === 0}
            {@const G = groupOuterColSpan(g)}
            <div
              class="relative flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch overflow-hidden rounded-md border border-gray-200/60 bg-transparent py-1.5 shadow-[-2px_5px_14px_-3px_rgba(15,23,42,0.07),0_1px_1px_0_rgba(15,23,42,0.04)] dark:border-gray-500/30 dark:shadow-[-2px_6px_20px_-4px_rgba(0,0,0,0.45)]"
              style={placed?.grid ? gridAreaStyle(placed.grid) : ""}
              data-testid="editor-tile"
              data-tile-id={d.id}
              data-editor-group="true"
              role="group"
              aria-label="Container {g.id}: drop plugins here or drag the grip to move"
              ondragover={onAddTileToGroup ? onGroupPluginDragOver : undefined}
              ondrop={onAddTileToGroup ? (e: DragEvent) => onGroupPluginDrop(e, g.id) : undefined}
            >
              <button
                type="button"
                class="absolute left-1 top-1 z-20 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:bg-gray-50 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label="Drag to move group on dashboard"
                data-testid="editor-tile-drag-handle"
                use:dragHandle
              >
                <GripVertical class="h-5 w-5" aria-hidden="true" />
              </button>
              {#if editLayout && onEditGroup}
                <button
                  type="button"
                  class="absolute right-10 top-1 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white/95 text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-300 dark:hover:bg-gray-700"
                  aria-label="Edit container placement"
                  data-testid="editor-group-edit"
                  onpointerdown={(e) => e.stopPropagation()}
                  onclick={() => onEditGroup(g)}
                >
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                </button>
              {/if}
              {#if onDeleteRootItem}
                <button
                  type="button"
                  class="absolute right-1 top-1 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-red-200 bg-white/95 text-red-600 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-gray-800/95 dark:text-red-400 dark:hover:bg-red-950/40"
                  aria-label="Remove container from dashboard"
                  data-testid="editor-group-delete"
                  onpointerdown={(e) => e.stopPropagation()}
                  onclick={() => onDeleteRootItem(g.id)}
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                </button>
              {/if}
              <div
                class="min-h-0 w-full min-w-0 flex-1 pl-0 pt-8"
                role="region"
                aria-label="Container {g.id}: drop plugins or reorder tiles"
                ondragover={onAddTileToGroup ? onGroupPluginDragOver : undefined}
                ondrop={onAddTileToGroup ? (e: DragEvent) => onGroupPluginDrop(e, g.id) : undefined}
              >
                <div class="relative w-full min-h-0 flex-1" class:min-h-28={isGroupEmpty}>
                  {#if g.innerWrap === true}
                    <div
                      class="flex h-full w-full min-w-0 flex-wrap content-start items-stretch gap-2 {isGroupEmpty
                        ? 'min-h-28'
                        : 'min-h-0'}"
                      use:dragHandleZone={{
                        items: gItems,
                        flipDurationMs: dashboardEditorNestedFlipMs(),
                        type: SVELTE_DND_TYPE_DASHBOARD,
                        autoAriaDisabled: true,
                        morphDisabled: true,
                        dropAnimationDisabled: true,
                        dropTargetStyle: editorDropTargetStyle,
                        transformDraggedElement: dashboardEditorTransformDragged,
                      }}
                      onconsider={handleGroupConsider(g.id)}
                      onfinalize={handleGroupFinalize(g.id)}
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
                            class="relative box-border flex min-h-0 max-w-full min-w-0 flex-col rounded border border-dashed border-gray-200/80 bg-white/30 dark:border-gray-600/50 dark:bg-gray-900/20"
                            style="flex: 0 0 min(100%, calc(100% * {T} / {G}));{rs > 1
                              ? ` min-height: ${Math.min(12, rs) * 2.25}rem;`
                              : ''}"
                            data-testid="editor-tile"
                            data-tile-id={c.id}
                          >
                            <button
                              type="button"
                              class="absolute left-1 top-1 z-20 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded border border-gray-200 bg-white/90 text-gray-500 shadow-sm active:cursor-grabbing dark:border-gray-600 dark:bg-gray-800/90"
                              aria-label="Drag to reorder tile in group"
                              use:dragHandle
                            >
                              <GripVertical class="h-4 w-4" aria-hidden="true" />
                            </button>
                            <div class="min-h-0 w-full min-w-0 flex-1 pt-7">
                              <TileEditChrome
                                tile={t}
                                onEdit={onEditTile}
                                onDelete={editLayout && onDeleteGroupChildTile
                                  ? () => onDeleteGroupChildTile(g.id, t.id)
                                  : undefined}
                                showEditButton={editLayout}
                              >
                                {#snippet children()}
                                  <p
                                    class="min-h-6 truncate border-b border-gray-100 py-0.5 pl-8 pr-1 text-[10px] text-gray-400 dark:border-gray-700 dark:text-gray-500"
                                  >
                                    In group
                                  </p>
                                  {@render renderTile(t, true)}
                                {/snippet}
                              </TileEditChrome>
                            </div>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  {:else}
                    <div
                      class="h-full w-full min-h-0 min-w-0 max-w-full overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable_both-edges] flex min-w-0 max-w-full flex-nowrap content-start items-stretch gap-2 {isGroupEmpty
                        ? 'min-h-28'
                        : ''}"
                      use:noWrapStripPortMeasure={g.id}
                      use:dragHandleZone={{
                        items: gItems,
                        flipDurationMs: dashboardEditorNestedFlipMs(),
                        type: SVELTE_DND_TYPE_DASHBOARD,
                        autoAriaDisabled: true,
                        morphDisabled: true,
                        dropAnimationDisabled: true,
                        dropTargetStyle: editorDropTargetStyle,
                        transformDraggedElement: dashboardEditorTransformDragged,
                      }}
                      onconsider={handleGroupConsider(g.id)}
                      onfinalize={handleGroupFinalize(g.id)}
                    >
                      {#each gItems as c (c.id)}
                        {#if isDndCellGroup(c.item)}
                          {@const sub = c.item}
                          {@const Gs = groupOuterColSpan(sub)}
                          {@const portW = noWrapEditPortW[g.id] ?? 0}
                          {@const wpx = G > 0 && portW > 0 ? (portW * Gs) / G : 0}
                          {@const subList = dedupeById(
                            dndByGroup[sub.id] ?? sub.children.map((ch) => groupChildToDnd(ch)),
                          )}
                          <div
                            class="relative box-border flex max-w-none min-w-0 shrink-0 flex-col rounded border border-dashed border-amber-200/90 bg-amber-50/35 [min-width:2.5rem] dark:border-amber-700/40 dark:bg-amber-950/25"
                            style="width: {wpx < 1 ? 120 : wpx}px; min-height: 6rem;"
                            data-testid="editor-nested-group"
                            data-editor-group="true"
                            data-tile-id={c.id}
                          >
                            <p class="truncate px-2 pt-1 text-[10px] font-medium text-amber-900/90 dark:text-amber-200/90">
                              Container {sub.id}
                            </p>
                            <div
                              class="mt-1 flex min-h-0 min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto px-1 pb-1"
                              use:dragHandleZone={{
                                items: subList,
                                flipDurationMs: dashboardEditorNestedFlipMs(),
                                type: SVELTE_DND_TYPE_DASHBOARD,
                                autoAriaDisabled: true,
                                morphDisabled: true,
                                dropAnimationDisabled: true,
                                dropTargetStyle: editorDropTargetStyle,
                                transformDraggedElement: dashboardEditorTransformDragged,
                              }}
                              onconsider={handleGroupConsider(sub.id)}
                              onfinalize={handleGroupFinalize(sub.id)}
                            >
                              {#each subList as nc (nc.id)}
                                {#if isDndCellGroup(nc.item)}
                                  <div
                                    class="shrink-0 rounded border border-gray-300/80 px-2 py-1 text-[10px] text-gray-500 dark:border-gray-600 dark:text-gray-400"
                                    data-testid="editor-nested-group-deep"
                                  >
                                    {nc.item.id}
                                  </div>
                                {:else}
                                  {@const t = dndListItemToDashboardTile(nc)}
                                  <div
                                    class="relative min-w-[5rem] shrink-0 rounded border border-dashed border-gray-200/80 bg-white/40 p-1 dark:border-gray-600/50 dark:bg-gray-900/30"
                                    data-testid="editor-tile"
                                    data-tile-id={nc.id}
                                  >
                                    <button
                                      type="button"
                                      class="absolute left-0.5 top-0.5 z-10 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded border border-gray-200 bg-white/90 text-gray-500 shadow-sm active:cursor-grabbing dark:border-gray-600 dark:bg-gray-800/90"
                                      aria-label="Drag to reorder tile in nested container"
                                      use:dragHandle
                                    >
                                      <GripVertical class="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                    <div class="min-h-0 w-full min-w-0 pt-6">
                                      <TileEditChrome
                                        tile={t}
                                        onEdit={onEditTile}
                                        onDelete={editLayout && onDeleteGroupChildTile
                                          ? () => onDeleteGroupChildTile(sub.id, t.id)
                                          : undefined}
                                        showEditButton={editLayout}
                                      >
                                        {#snippet children()}
                                          {@render renderTile(t, true)}
                                        {/snippet}
                                      </TileEditChrome>
                                    </div>
                                  </div>
                                {/if}
                              {/each}
                            </div>
                          </div>
                        {:else}
                          {@const t = dndListItemToDashboardTile(c)}
                          {@const T = effectiveColSpan(t)}
                          {@const rs = effectiveRowSpan(t)}
                          {@const portW = noWrapEditPortW[g.id] ?? 0}
                          {@const wpx = G > 0 && portW > 0 ? (portW * T) / G : 0}
                          <div
                            class="relative box-border flex max-w-none min-w-0 shrink-0 flex-col rounded border border-dashed border-gray-200/80 bg-white/30 [min-width:2.5rem] dark:border-gray-600/50 dark:bg-gray-900/20"
                            style="width: {wpx < 1 ? 40 : wpx}px;{rs > 1
                              ? ` min-height: ${Math.min(12, rs) * 2.25}rem;`
                              : ' min-height: 0;'}"
                            data-testid="editor-tile"
                            data-tile-id={c.id}
                          >
                            <button
                              type="button"
                              class="absolute left-1 top-1 z-20 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded border border-gray-200 bg-white/90 text-gray-500 shadow-sm active:cursor-grabbing dark:border-gray-600 dark:bg-gray-800/90"
                              aria-label="Drag to reorder tile in group"
                              use:dragHandle
                            >
                              <GripVertical class="h-4 w-4" aria-hidden="true" />
                            </button>
                            <div class="min-h-0 w-full min-w-0 flex-1 pt-7">
                              <TileEditChrome
                                tile={t}
                                onEdit={onEditTile}
                                onDelete={editLayout && onDeleteGroupChildTile
                                  ? () => onDeleteGroupChildTile(g.id, t.id)
                                  : undefined}
                                showEditButton={editLayout}
                              >
                                {#snippet children()}
                                  <p
                                    class="min-h-6 truncate border-b border-gray-100 py-0.5 pl-8 pr-1 text-[10px] text-gray-400 dark:border-gray-700 dark:text-gray-500"
                                  >
                                    In group
                                  </p>
                                  {@render renderTile(t, true)}
                                {/snippet}
                              </TileEditChrome>
                            </div>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                  {#if isGroupEmpty}
                    <div
                      class="pointer-events-none absolute inset-0 z-0 flex min-h-28 flex-col items-center justify-center gap-1 rounded border border-dashed border-gray-300/90 bg-gray-50/50 px-2 py-4 dark:border-gray-600 dark:bg-gray-900/30"
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
              class="relative flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              style={placed?.grid ? gridAreaStyle(placed.grid) : gridColumnSpanStyle(cv)}
              data-testid="editor-tile"
              data-tile-id={d.id}
            >
              <button
                type="button"
                class="absolute left-1 top-1 z-20 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:bg-gray-50 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label="Drag to reorder tile"
                data-testid="editor-tile-drag-handle"
                use:dragHandle
              >
                <GripVertical class="h-5 w-5" aria-hidden="true" />
              </button>
              <div class="flex min-h-0 min-w-0 w-full flex-1 flex-col pt-8">
                <TileEditChrome
                  tile={cv}
                  onEdit={onEditTile}
                  onDelete={editLayout && onDeleteRootItem ? () => onDeleteRootItem(cv.id) : undefined}
                  showEditButton={editLayout}
                >
                  {#snippet children()}
                    {#if placed?.kind === "tile" && placed.grid}
                      <p
                        class="min-h-6 border-b border-gray-100 truncate py-1 pl-10 pr-2 text-[10px] text-gray-400 dark:border-gray-700 dark:text-gray-500"
                        title="Span {placed.grid.colSpan}×{placed.grid.rowSpan} · row {placed.grid.row + 1}"
                      >
                        Span {placed.grid.colSpan}×{placed.grid.rowSpan} · row {placed.grid.row + 1}
                      </p>
                    {/if}
                    {@render renderTile(cv, false)}
                  {/snippet}
                </TileEditChrome>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <div
      class="grid w-full auto-rows-[minmax(0,auto)] grid-cols-[repeat(20,minmax(0,1fr))] content-start place-items-stretch"
      data-dashboard-tile-grid
      aria-label="Dashboard tiles"
    >
      {#each layout.items as it (it.id)}
        {#if it.kind === "group"}
          <div
            class="box-border min-h-0 w-full !max-w-full min-w-0 flex-1 self-stretch {it.showBorder !== false
              ? 'overflow-hidden rounded-lg border border-gray-200/60 bg-transparent py-1.5 shadow-[-2px_5px_14px_-3px_rgba(15,23,42,0.07),0_1px_1px_0_rgba(15,23,42,0.04)] dark:border-gray-500/30 dark:shadow-[-2px_6px_20px_-4px_rgba(0,0,0,0.45)]'
              : ''}"
            data-dashboard-group={it.id}
            style={it.grid ? gridAreaStyle(it.grid) : ""}
            aria-label="Group {it.id}"
          >
            {#if it.innerWrap === true}
              {@const Gr = groupOuterColSpan(it)}
              {@const tilesOnly = dedupeById(it.children).filter(
                (c): c is DashboardTile => !isDashboardGroupNode(c),
              )}
              {@const packed = dedupeById(packGroupChildrenRowWrapInOrder(tilesOnly, Gr))}
              <div
                class="grid h-full w-full min-h-0 min-w-0 auto-rows-[minmax(0,auto)] content-start gap-2 [box-sizing:border-box] [min-width:0] [place-self:stretch] [align-self:stretch] [overflow:visible]"
                style="grid-template-columns: repeat({Gr}, minmax(0, 1fr));"
              >
                {#each packed as tile (tile.id)}
                  <div
                    class="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col place-self-stretch"
                    data-tile-id={tile.id}
                    data-in-row-panel={it.showBorder !== false ? "true" : undefined}
                    style={tile.grid
                      ? groupGridAreaStyle(tile.grid, Gr)
                      : groupGridColumnSpanStyle(tile, Gr)}
                  >
                    <TileEditChrome
                      {tile}
                      onEdit={onEditTile}
                      onDelete={editLayout && onDeleteGroupChildTile
                        ? () => onDeleteGroupChildTile(it.id, tile.id)
                        : undefined}
                      showEditButton={editLayout}
                    >
                      {#snippet children()}
                        {@render renderTile(tile, true)}
                      {/snippet}
                    </TileEditChrome>
                  </div>
                {/each}
              </div>
            {:else}
              {@const Gr = groupOuterColSpan(it)}
              {#if dedupeById(it.children).some((c) => isDashboardGroupNode(c))}
                <DashboardReadNestedHost
                  group={it}
                  outerCols={Gr}
                  {editLayout}
                  {onEditTile}
                  {onDeleteGroupChildTile}
                >
                  {#snippet tileContent(t, _inGroup)}
                    {@render renderTile(t, true)}
                  {/snippet}
                </DashboardReadNestedHost>
              {:else}
                <GroupReadNoWrap
                  rowGroups={noWrapReadRowGroups(dedupeById(it.children) as DashboardTile[])}
                  gCols={Gr}
                  groupId={it.id}
                  showPanelChrome={it.showBorder !== false}
                  {editLayout}
                  {onEditTile}
                  {onDeleteGroupChildTile}
                >
                  {#snippet tileContent(t)}
                    {@render renderTile(t, true)}
                  {/snippet}
                </GroupReadNoWrap>
              {/if}
            {/if}
          </div>
        {:else}
          <div
            class="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col place-self-stretch"
            data-tile-id={it.id}
            style={it.grid ? gridAreaStyle(it.grid) : gridColumnSpanStyle(it)}
          >
            <TileEditChrome
              tile={it}
              onEdit={onEditTile}
              onDelete={editLayout && onDeleteRootItem ? () => onDeleteRootItem(it.id) : undefined}
              showEditButton={editLayout}
            >
              {#snippet children()}
                {@render renderTile(it, false)}
              {/snippet}
            </TileEditChrome>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
