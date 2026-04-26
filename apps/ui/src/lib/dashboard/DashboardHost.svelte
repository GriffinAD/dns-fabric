<script lang="ts">
  import {
    FEATURE_FLAG_NAMES,
    setFeatureFlag,
    SOURCES,
  } from "svelte-dnd-action";
  import type { DndEvent } from "svelte-dnd-action";

  setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, true);

  import type { PluginEntry } from "../api/types";
  import { DataGateway } from "../dataGateway";
  import PluginPalette from "../palette/PluginPalette.svelte";
  import { setPaletteAddGroupDragData, setPalettePluginDragData } from "../palette/paletteDragCodec";
  import { getFeatureFlag } from "../platform/featureFlags";
  import {
    gridAreaStyle,
    gridColumnSpanStyle,
    groupGridAreaStyle,
    groupGridColumnSpanStyle,
    groupOuterColSpan,
    packGroupChildrenRowWrapInOrder,
    reorderRootLayoutItemsPreservingSlotOrigins,
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
  import DashboardEditRootGrid from "./DashboardEditRootGrid.svelte";
  import {
    createDashboardEditorTransformDragged,
    dashboardEditorDropTargetStyle,
    dashboardEditorRootFlipMs,
    readPrefersReducedMotion,
  } from "./interactions/dndEditorFeedback";
  import {
    createPaletteRootDropController,
    type PaletteRootInsertPreview,
  } from "./interactions/editorPaletteRootDrop";
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
    onAddGroupToGroup,
    onAddTileToGroup,
    onLayoutStructureChange,
    onPerfTileGridHint,
    activeEditorKind = null as "tile" | "group" | null,
    activeEditorId = null as string | null,
  }: {
    layout: DashboardLayoutV3;
    gateway: DataGateway;
    onEditTile?: (tile: DashboardTile) => void;
    onEditGroup?: (g: DashboardGroup) => void;
    editLayout?: boolean;
    plugins?: PluginEntry[];
    onAddTile?: (pluginId: string, insertBeforeIndex?: number) => void;
    /** Add a new empty container on the root grid at index, or append when index is omitted. */
    onAddGroup?: (insertBeforeIndex?: number) => void;
    /** Add a new empty nested container inside an existing group (nowrap / nested-capable parents only). */
    onAddGroupToGroup?: (parentGroupId: string) => void;
    /** Drop a plugin from the palette onto a container in edit mode. */
    onAddTileToGroup?: (groupId: string, pluginId: string) => void;
    onLayoutStructureChange?: (next: DashboardLayout) => void;
    onPerfTileGridHint?: (tileId: string, hint: { colSpan: number; rowSpan: number }) => void;
    /** Inspector / keyboard selection — drives `.editor-surface-in-play` on the matching tile or container. */
    activeEditorKind?: "tile" | "group" | null;
    activeEditorId?: string | null;
  } = $props();

  /** Passed to `DashboardEditRootGrid` — neutral glass; lateral/top via `--editor-chrome-*` on grid chrome. */
  const CHROME_DRAG_SM =
    "editor-chrome-drag editor-chrome-top absolute left-2 z-50 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-md border border-slate-200/80 bg-slate-50/95 shadow-sm backdrop-blur-[2px] focus-visible:ring-2 focus-visible:ring-primary-500/60 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-900/85 dark:hover:bg-gray-800";
  const CHROME_EDIT_SM =
    "editor-chrome-edit editor-chrome-top absolute right-2 z-50 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-slate-200/80 bg-slate-50/95 shadow-sm backdrop-blur-[2px] hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-500/60 dark:border-gray-600 dark:bg-gray-900/90 dark:hover:bg-gray-800";

  function editorTileInPlay(id: string): boolean {
    return editLayout && activeEditorKind === "tile" && activeEditorId === id;
  }

  function editorGroupInPlay(id: string): boolean {
    return editLayout && activeEditorKind === "group" && activeEditorId === id;
  }

  let dndRoot = $state<DndListItem[]>([]);
  let dndByGroup = $state<Record<string, DndListItem[]>>({});

  function rootItemToDnd(it: RootLayoutItem): DndListItem {
    return { id: it.id, item: it };
  }

  function groupChildToDnd(c: GroupChild): DndListItem {
    return { id: c.id, item: c };
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

  /** Kea palette HTML5 drag only — root insertion slot preview (see `paletteDragCodec.isPaletteFabricHtml5Drag`). */
  let paletteRootInsertPreview = $state<PaletteRootInsertPreview>(null);

  const paletteRootDrop = createPaletteRootDropController({
    getRootDndIds: () => dndRoot.map((d) => d.id),
    getPreview: () => paletteRootInsertPreview,
    setPreview: (p) => {
      paletteRootInsertPreview = p;
    },
    getOnAddTile: () => onAddTile,
    getOnAddGroup: () => onAddGroup,
    getOnAddTileToGroup: () => onAddTileToGroup,
    getOnAddGroupToGroup: () => onAddGroupToGroup,
  });

  $effect(() => {
    if (!editLayout || typeof window === "undefined") return;
    const onDragEnd = () => paletteRootDrop.clearPreview();
    window.addEventListener("dragend", onDragEnd);
    return () => window.removeEventListener("dragend", onDragEnd);
  });

  /**
   * svelte-dnd-action hit-tests nested zones before the root (deepest first). While reordering a
   * **root-level container** with the pointer, nested strips must not accept drops from the root
   * zone (same `type`), or the shadow jumps into the hovered container’s inner list instead of a
   * new root row. Root **tiles** entering a group must still work.
   */
  type EditorPointerDnDKind = null | { origin: "root"; isGroup: boolean } | { origin: "nested" };
  let editorPointerDnDKind = $state<EditorPointerDnDKind>(null);

  const nestedZoneDropFromOthersDisabled = $derived(
    editorPointerDnDKind != null &&
      editorPointerDnDKind.origin === "root" &&
      editorPointerDnDKind.isGroup,
  );

  const dashboardEditorTransformDragged = $derived.by(() =>
    createDashboardEditorTransformDragged(reducedMotion),
  );

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
    paletteRootDrop.clearPreview();
    if (e.detail.info.source === SOURCES.POINTER) {
      editorPointerDndActive = true;
      const wrap = dndRoot.find((d) => d.id === e.detail.info.id);
      if (wrap) {
        editorPointerDnDKind = { origin: "root", isGroup: isDndCellGroup(wrap.item) };
      }
    }
    dndRoot = dedupeById(e.detail.items);
  }

  function handleRootFinalize(e: DndConsiderFinalize) {
    editorPointerDndActive = false;
    editorPointerDnDKind = null;
    dndRoot = dedupeById(e.detail.items);
    queueMicrotask(() => {
      if (!onLayoutStructureChange) return;
      commitDndToLayout();
    });
  }

  function handleGroupConsider(gid: string) {
    return (e: DndConsiderFinalize) => {
      paletteRootDrop.clearPreview();
      if (e.detail.info.source === SOURCES.POINTER) {
        editorPointerDndActive = true;
        editorPointerDnDKind = { origin: "nested" };
      }
      const items = dedupeById(e.detail.items);
      dndByGroup = { ...dndByGroup, [gid]: items };
    };
  }

  function handleGroupFinalize(gid: string) {
    return (e: DndConsiderFinalize) => {
      editorPointerDndActive = false;
      editorPointerDnDKind = null;
      const items = dedupeById(e.detail.items);
      dndByGroup = { ...dndByGroup, [gid]: items };
      queueMicrotask(() => {
        if (!onLayoutStructureChange) return;
        commitDndToLayout();
      });
    };
  }

</script>

{#snippet renderTile(tile: DashboardTile)}
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
        class="rounded-lg border border-dashed border-gray-200/70 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/50"
        data-dashboard-editor="palette"
        data-testid="layout-edit-palette"
        aria-label="Add dashboard plugins"
      >
        <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">
          <strong>Containers:</strong> use <span class="font-mono">Add container</span> or drag it onto the grid (drops
          <strong>before</strong> the tile or container under the pointer, or at the end on empty space). Drag onto a
          <strong>nowrap</strong> container body to nest a new empty container when Auto wrap is off. Then
          <strong>drag the grip (⋮⋮)</strong> on the container (hover the container chrome, not a nested plugin) to move
          the whole container. <strong>Tiles:</strong> drag
          a plugin chip to the grid or <strong>into a container</strong>. <strong>Reorder</strong> root tiles and tiles
          inside a container with their grips. <strong>Hover</strong> each plugin tile to show its grip and pencil
          (overlaid on the tile). <strong>Containers</strong> show their own grip row at the top when you hover the
          container chrome, not while the pointer is over a nested plugin. Use the pencil to resize
          and configure.
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
    <DashboardEditRootGrid
      dndRoot={dndRoot}
      dndByGroup={dndByGroup}
      rootPackedById={rootPackedById}
      paletteRootInsertPreview={paletteRootInsertPreview}
      paletteRootDrop={paletteRootDrop}
      editorPointerDndActive={editorPointerDndActive}
      rootFlipMs={rootFlipMs}
      editorDropTargetStyle={editorDropTargetStyle}
      dashboardEditorTransformDragged={dashboardEditorTransformDragged}
      nestedZoneDropFromOthersDisabled={nestedZoneDropFromOthersDisabled}
      noWrapEditPortW={noWrapEditPortW}
      noWrapStripPortMeasure={noWrapStripPortMeasure}
      dndType={SVELTE_DND_TYPE_DASHBOARD}
      chromeDragSm={CHROME_DRAG_SM}
      chromeEditSm={CHROME_EDIT_SM}
      onRootConsider={handleRootConsider}
      onRootFinalize={handleRootFinalize}
      onGroupConsider={handleGroupConsider}
      onGroupFinalize={handleGroupFinalize}
      editorTileInPlay={editorTileInPlay}
      editorGroupInPlay={editorGroupInPlay}
      onAddTileToGroup={onAddTileToGroup}
      onAddGroupToGroup={onAddGroupToGroup}
      onEditGroup={onEditGroup}
      {editLayout}
      {onEditTile}
      getSubDndList={(sub) => dedupeById(dndByGroup[sub.id] ?? sub.children.map((ch) => groupChildToDnd(ch)))}
    >
      {#snippet tileContent(tile)}
        {@render renderTile(tile)}
      {/snippet}
    </DashboardEditRootGrid>
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
              ? 'overflow-hidden rounded-lg border border-slate-200/70 bg-transparent py-1.5 shadow-[-2px_5px_14px_-3px_rgba(15,23,42,0.07),0_1px_1px_0_rgba(15,23,42,0.04)] dark:border-gray-500/30 dark:shadow-[-2px_6px_20px_-4px_rgba(0,0,0,0.45)]'
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
                      showEditButton={editLayout}
                    >
                      {#snippet children()}
                        {@render renderTile(tile)}
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
                >
                  {#snippet tileContent(t)}
                    {@render renderTile(t)}
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
                >
                  {#snippet tileContent(t)}
                    {@render renderTile(t)}
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
              showEditButton={editLayout}
            >
              {#snippet children()}
                {@render renderTile(it)}
              {/snippet}
            </TileEditChrome>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
