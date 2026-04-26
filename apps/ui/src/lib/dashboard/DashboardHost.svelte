<script lang="ts">
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
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
  import {
    isPaletteFabricHtml5Drag,
    parsePaletteDrop,
    setPaletteAddGroupDragData,
    setPalettePluginDragData,
  } from "../palette/paletteDragCodec";
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
    createDashboardEditorTransformDragged,
    dashboardEditorDropTargetStyle,
    dashboardEditorNestedFlipMs,
    dashboardEditorRootFlipMs,
    readPrefersReducedMotion,
  } from "./interactions/dndEditorFeedback";
  import {
    EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX,
    EDITOR_CHROME_TOP_OFFSET_PX,
    EDITOR_PLUGIN_HOVER_SHELL,
    EDITOR_PLUGIN_HOVER_VISIBLE,
    nestedContainerDisplayTitle,
  } from "./interactions/editorChrome";
  import {
    findRootInsertIndexFromElementsFromPoint,
    shouldSuppressPaletteRootInsertPreview,
  } from "./paletteDropInsertIndex";
  import { dedupeById } from "./layoutTree";
  import {
    DASHBOARD_STRIP_GAP_1_PX,
    DASHBOARD_STRIP_GAP_2_PX,
    flexStripDistributedWidth,
    stripScrollportObserve,
  } from "./stripWidth";
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

  /** Neutral glass; lateral/top via `--editor-chrome-*` on `editor-grid-chrome` (see `editorChrome.ts`). */
  const CHROME_DRAG_LG =
    "editor-chrome-drag editor-chrome-top absolute left-2 z-50 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md border border-gray-200/90 bg-white/95 shadow-sm backdrop-blur-[2px] hover:bg-gray-50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500/60 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-900/90 dark:hover:bg-gray-800";
  const CHROME_EDIT_LG =
    "editor-chrome-edit editor-chrome-top absolute right-2 z-50 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-200/90 bg-white/95 shadow-sm backdrop-blur-[2px] hover:bg-gray-50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500/60 dark:border-gray-600 dark:bg-gray-900/90 dark:hover:bg-gray-800";
  const CHROME_DRAG_MD =
    "editor-chrome-drag editor-chrome-top absolute left-2 z-50 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md border border-gray-200/90 bg-white/90 shadow-sm backdrop-blur-[2px] focus-visible:ring-2 focus-visible:ring-primary-500/60 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-900/85 dark:hover:bg-gray-800";
  const CHROME_EDIT_MD =
    "editor-chrome-edit editor-chrome-top absolute right-2 z-50 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-gray-200/90 bg-white/95 shadow-sm backdrop-blur-[2px] hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary-500/60 dark:border-gray-600 dark:bg-gray-900/90 dark:hover:bg-gray-800";
  const CHROME_DRAG_SM =
    "editor-chrome-drag editor-chrome-top absolute left-2 z-50 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-md border border-gray-200/90 bg-white/90 shadow-sm backdrop-blur-[2px] focus-visible:ring-2 focus-visible:ring-primary-500/60 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-900/85 dark:hover:bg-gray-800";
  const CHROME_EDIT_SM =
    "editor-chrome-edit editor-chrome-top absolute right-2 z-50 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-gray-200/90 bg-white/95 shadow-sm backdrop-blur-[2px] hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary-500/60 dark:border-gray-600 dark:bg-gray-900/90 dark:hover:bg-gray-800";
  const CHROME_DRAG_XS =
    "editor-chrome-drag editor-chrome-top absolute left-2 z-50 flex h-5 w-5 cursor-grab touch-none items-center justify-center rounded-md border border-gray-200/90 bg-white/90 shadow-sm backdrop-blur-[2px] focus-visible:ring-2 focus-visible:ring-primary-500/60 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-900/85 dark:hover:bg-gray-800";
  const CHROME_EDIT_XS =
    "editor-chrome-edit editor-chrome-top absolute right-2 z-50 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border border-gray-200/90 bg-white/95 shadow-sm backdrop-blur-[2px] hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary-500/60 dark:border-gray-600 dark:bg-gray-900/90 dark:hover:bg-gray-800";

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

  /** Kea palette HTML5 drag only — root insertion slot preview (see `isPaletteFabricHtml5Drag`). */
  type PaletteRootInsertPreview = null | { kind: "before"; index: number } | { kind: "append" };
  let paletteRootInsertPreview = $state<PaletteRootInsertPreview>(null);

  function paletteDragElementsFromPoint(clientX: number, clientY: number): Element[] {
    return typeof document.elementsFromPoint === "function"
      ? [...document.elementsFromPoint(clientX, clientY)]
      : [];
  }

  function clearPaletteRootInsertPreview() {
    if (paletteRootInsertPreview !== null) paletteRootInsertPreview = null;
  }

  $effect(() => {
    if (!editLayout || typeof window === "undefined") return;
    const onDragEnd = () => clearPaletteRootInsertPreview();
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
    clearPaletteRootInsertPreview();
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
      clearPaletteRootInsertPreview();
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

  function onCanvasDrop(e: DragEvent) {
    e.preventDefault();
    clearPaletteRootInsertPreview();
    const p = parsePaletteDrop(e.dataTransfer);
    if (!p) return;
    const rootIds = dndRoot.map((d) => d.id);
    const insertAt = findRootInsertIndexFromElementsFromPoint(e.clientX, e.clientY, rootIds, (x, y) =>
      typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(x, y) : [],
    );
    if (p.kind === "group") {
      onAddGroup?.(insertAt);
      return;
    }
    if (p.kind === "plugin") onAddTile?.(p.id, insertAt);
  }

  /**
   * Keep HTML5 palette drop on `editor-grid-chrome` (not on `use:dragHandleZone`).
   * Only `preventDefault` for **Kea palette** drags — unconditional cancel confused default drag
   * behaviour over the grid while reordering with svelte-dnd.
   */
  function onEditorChromeDragOver(e: DragEvent) {
    const dt = e.dataTransfer;
    if (!dt) return;
    if (!isPaletteFabricHtml5Drag(dt)) {
      clearPaletteRootInsertPreview();
      return;
    }
    e.preventDefault();
    dt.dropEffect = "copy";
    const stack = paletteDragElementsFromPoint(e.clientX, e.clientY);
    if (shouldSuppressPaletteRootInsertPreview(stack)) {
      clearPaletteRootInsertPreview();
      return;
    }
    const rootIds = dndRoot.map((d) => d.id);
    const insertAt = findRootInsertIndexFromElementsFromPoint(e.clientX, e.clientY, rootIds, (x, y) =>
      typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(x, y) : [],
    );
    paletteRootInsertPreview =
      insertAt === undefined ? { kind: "append" } : { kind: "before", index: insertAt };
  }

  function onGroupPluginDragOver(e: DragEvent) {
    const dt = e.dataTransfer;
    if (!dt) return;
    if (!isPaletteFabricHtml5Drag(dt)) return;
    e.preventDefault();
    dt.dropEffect = "copy";
    clearPaletteRootInsertPreview();
  }

  function onGroupPluginDrop(e: DragEvent, groupId: string) {
    e.preventDefault();
    clearPaletteRootInsertPreview();
    const p = parsePaletteDrop(e.dataTransfer);
    if (p?.kind === "plugin") {
      e.stopPropagation();
      onAddTileToGroup?.(groupId, p.id);
      return;
    }
    if (p?.kind === "group") {
      e.stopPropagation();
      onAddGroupToGroup?.(groupId);
    }
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
        class="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/50"
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
    <div
      class="relative min-h-[120px] overflow-hidden rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600"
      data-testid="editor-grid-chrome"
      data-editor-pointer-dnd={editorPointerDndActive ? "true" : "false"}
      role="region"
      aria-label="Drop plugins or a new container onto the grid"
      style="--editor-chrome-button-offset: {EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX}px; --editor-chrome-top: {EDITOR_CHROME_TOP_OFFSET_PX}px;"
      ondragover={onEditorChromeDragOver}
      ondrop={onCanvasDrop}
    >
      <!-- `centreDraggedOnCursor` off on all zones: wide grid tiles + drag grips — true snaps the clone’s midpoint to the pointer on the first move and wrecks hit-testing / FLIP. -->
      <div
        class="relative grid min-h-[120px] w-full auto-rows-[minmax(0,auto)] grid-cols-[repeat(20,minmax(0,1fr))] content-start place-items-stretch pb-[min(50vh,40rem)] {paletteRootInsertPreview?.kind ===
          'append' && dndRoot.length === 0
          ? 'editor-palette-root-insert-preview-before'
          : ''}"
        data-testid="editor-drop-zone"
        role="group"
        aria-label="Dashboard tile grid"
        use:dragHandleZone={{
          items: dndRoot,
          flipDurationMs: rootFlipMs,
          type: SVELTE_DND_TYPE_DASHBOARD,
          autoAriaDisabled: true,
          morphDisabled: true,
          centreDraggedOnCursor: false,
          dropTargetStyle: editorDropTargetStyle,
          transformDraggedElement: dashboardEditorTransformDragged,
        }}
        onconsider={handleRootConsider}
        onfinalize={handleRootFinalize}
      >
        {#each dndRoot as d, i (d.id)}
          {@const placed = rootPackedById.get(d.id)}
          {@const g = isDndCellGroup(d.item) ? d.item : null}
          {@const cv = !isDndCellGroup(d.item) ? (d.item as DashboardTile) : null}
          {#if g}
            {@const gItems = dedupeById(dndByGroup[g.id] ?? [])}
            {@const isGroupEmpty = gItems.length === 0}
            {@const G = groupOuterColSpan(g)}
            <div
              class="editor-root-container-shell relative flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch rounded-md border border-gray-200/60 bg-transparent pt-2 pb-2 shadow-[-2px_5px_14px_-3px_rgba(15,23,42,0.07),0_1px_1px_0_rgba(15,23,42,0.04)] dark:border-gray-500/30 dark:shadow-[-2px_6px_20px_-4px_rgba(0,0,0,0.45)] {editorGroupInPlay(g.id)
                ? 'editor-surface-in-play'
                : ''} {paletteRootInsertPreview?.kind === 'before' && paletteRootInsertPreview.index === i
                ? 'editor-palette-root-insert-preview-before'
                : ''} {paletteRootInsertPreview?.kind === 'append' && i === dndRoot.length - 1
                ? 'editor-palette-root-insert-preview-after'
                : ''}"
              style={placed?.grid ? gridAreaStyle(placed.grid) : ""}
              data-testid="editor-tile"
              data-tile-id={d.id}
              data-editor-group="true"
              role="group"
              aria-label="Container {g.id}: drop plugins here or drag the grip to move"
              ondragover={onAddTileToGroup || onAddGroupToGroup ? onGroupPluginDragOver : undefined}
              ondrop={onAddTileToGroup || onAddGroupToGroup ? (e: DragEvent) => onGroupPluginDrop(e, g.id) : undefined}
            >
              <!-- Anchor container chrome to the shell (selection outline), not the padded inner wrapper. -->
              <button
                type="button"
                class="{CHROME_DRAG_SM} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
                aria-label="Drag to move group on dashboard"
                data-testid="editor-tile-drag-handle"
                data-editor-container-chrome
                use:dragHandle
              >
                <GripVertical class="h-5 w-5" aria-hidden="true" />
              </button>
              {#if editLayout && onEditGroup}
                <button
                  type="button"
                  class="{CHROME_EDIT_SM} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
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
                ondragover={onAddTileToGroup || onAddGroupToGroup ? onGroupPluginDragOver : undefined}
                ondrop={onAddTileToGroup || onAddGroupToGroup ? (e: DragEvent) => onGroupPluginDrop(e, g.id) : undefined}
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
                        centreDraggedOnCursor: false,
                        dropTargetStyle: editorDropTargetStyle,
                        transformDraggedElement: dashboardEditorTransformDragged,
                        dropFromOthersDisabled: nestedZoneDropFromOthersDisabled,
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
                            class="{EDITOR_PLUGIN_HOVER_SHELL} relative box-border flex min-h-0 max-w-full min-w-0 flex-col rounded border border-dashed border-gray-200/80 bg-white/30 dark:border-gray-600/50 dark:bg-gray-900/20 {editorTileInPlay(c.id)
                              ? 'editor-surface-in-play'
                              : ''}"
                            style="flex: 0 0 min(100%, calc(100% * {T} / {G}));{rs > 1
                              ? ` min-height: ${Math.min(12, rs) * 2.25}rem;`
                              : ''}"
                            data-testid="editor-tile"
                            data-tile-id={c.id}
                          >
                            <p
                              class="{EDITOR_PLUGIN_HOVER_VISIBLE} min-h-0 truncate border-b border-gray-100/80 py-0.5 pl-1 pr-1 text-[10px] text-gray-400 dark:border-gray-700/80 dark:text-gray-500"
                              title={g.id}
                            >
                              {nestedContainerDisplayTitle(g.id)}
                            </p>
                            <div class="relative min-h-0 w-full min-w-0 flex-1">
                              <button
                                type="button"
                                class="{EDITOR_PLUGIN_HOVER_VISIBLE} {CHROME_DRAG_SM} text-emerald-600 dark:text-emerald-300"
                                aria-label="Drag to reorder tile in group"
                                use:dragHandle
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
                                    {@render renderTile(t)}
                                  {/snippet}
                                </TileEditChrome>
                              </div>
                            </div>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  {:else}
                    <div
                      class="h-full w-full min-h-0 min-w-0 max-w-full overflow-x-auto overflow-y-hidden flex min-w-0 max-w-full flex-nowrap content-start items-stretch gap-2 {isGroupEmpty
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
                        centreDraggedOnCursor: false,
                        dropTargetStyle: editorDropTargetStyle,
                        transformDraggedElement: dashboardEditorTransformDragged,
                        dropFromOthersDisabled: nestedZoneDropFromOthersDisabled,
                      }}
                      onconsider={handleGroupConsider(g.id)}
                      onfinalize={handleGroupFinalize(g.id)}
                    >
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
                          {@const subList = dedupeById(
                            dndByGroup[sub.id] ?? sub.children.map((ch) => groupChildToDnd(ch)),
                          )}
                          <div
                            class="editor-nested-container-shell relative box-border flex max-w-none min-w-0 shrink-0 flex-col rounded-md border border-dashed border-gray-300/75 bg-white/25 [min-width:2.5rem] dark:border-gray-600/60 dark:bg-gray-900/35 {editorGroupInPlay(sub.id)
                              ? 'editor-surface-in-play'
                              : ''}"
                            style="width: {wpx < 1 ? 120 : wpx}px; min-height: 6rem;"
                            title={sub.id}
                            data-testid="editor-nested-group"
                            data-editor-group="true"
                            data-tile-id={c.id}
                            role="group"
                            aria-label={`${nestedContainerDisplayTitle(sub.id)} (${sub.id}): drop plugins or add nested container`}
                            ondragover={onAddTileToGroup || onAddGroupToGroup ? onGroupPluginDragOver : undefined}
                            ondrop={onAddTileToGroup || onAddGroupToGroup ? (e: DragEvent) => onGroupPluginDrop(e, sub.id) : undefined}
                          >
                            <button
                              type="button"
                              class="{CHROME_DRAG_SM} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
                              aria-label="Drag to reorder nested container in group"
                              data-testid="editor-nested-group-drag-handle"
                              data-editor-container-chrome
                              use:dragHandle
                            >
                              <GripVertical class="h-4 w-4" aria-hidden="true" />
                            </button>
                            {#if editLayout && onEditGroup}
                              <button
                                type="button"
                                class="{CHROME_EDIT_SM} text-blue-600 dark:text-blue-300 focus-visible:opacity-100"
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
                              use:dragHandleZone={{
                                items: subList,
                                flipDurationMs: dashboardEditorNestedFlipMs(),
                                type: SVELTE_DND_TYPE_DASHBOARD,
                                autoAriaDisabled: true,
                                morphDisabled: true,
                                dropAnimationDisabled: true,
                                centreDraggedOnCursor: false,
                                dropTargetStyle: editorDropTargetStyle,
                                transformDraggedElement: dashboardEditorTransformDragged,
                                dropFromOthersDisabled: nestedZoneDropFromOthersDisabled,
                              }}
                              onconsider={handleGroupConsider(sub.id)}
                              onfinalize={handleGroupFinalize(sub.id)}
                            >
                              {#if subList.length === 0}
                                <div
                                  class="pointer-events-none flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center rounded border border-dashed border-gray-300/50 bg-gray-50/40 px-2 text-center text-[10px] text-gray-500 dark:border-gray-600/45 dark:bg-gray-950/25 dark:text-gray-400"
                                  data-testid="editor-nested-group-empty"
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
                                    class="shrink-0 rounded border border-dashed border-gray-300/70 px-2 py-1 text-[10px] text-gray-500 dark:border-gray-600/55 dark:text-gray-400"
                                    data-testid="editor-nested-group-deep"
                                    title={nc.item.id}
                                  >
                                    {nestedContainerDisplayTitle(nc.item.id)}
                                  </div>
                                {:else}
                                  {@const t = dndListItemToDashboardTile(nc)}
                                  {@const Tn = effectiveColSpan(t)}
                                  {@const subWpx = Gs > 0 && nestAvailPort > 0 ? (nestAvailPort * Tn) / Gs : 0}
                                  <div
                                    class="{EDITOR_PLUGIN_HOVER_SHELL} relative min-w-[5rem] shrink-0 rounded border border-dashed border-gray-200/80 bg-white/40 p-1 dark:border-gray-600/50 dark:bg-gray-900/30 {editorTileInPlay(nc.id)
                                      ? 'editor-surface-in-play'
                                      : ''}"
                                    style="width: {subWpx < 1 ? 40 : subWpx}px;{effectiveRowSpan(t) > 1
                                      ? ` min-height: ${Math.min(12, effectiveRowSpan(t)) * 2.25}rem;`
                                      : ' min-height: 0;'}"
                                    data-testid="editor-tile"
                                    data-tile-id={nc.id}
                                  >
                                    <p
                                      class="{EDITOR_PLUGIN_HOVER_VISIBLE} min-h-0 truncate border-b border-gray-100/80 py-0.5 pl-0.5 pr-0.5 text-[10px] text-gray-400 dark:border-gray-700/80 dark:text-gray-500"
                                      title={sub.id}
                                    >
                                      {nestedContainerDisplayTitle(sub.id)}
                                    </p>
                                    <div class="relative min-h-0 w-full min-w-0 flex-1">
                                      <button
                                        type="button"
                                        class="{EDITOR_PLUGIN_HOVER_VISIBLE} {CHROME_DRAG_SM} text-emerald-600 dark:text-emerald-300"
                                        aria-label="Drag to reorder tile in nested container"
                                        use:dragHandle
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
                                            {@render renderTile(t)}
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
                            class="{EDITOR_PLUGIN_HOVER_SHELL} relative box-border flex max-w-none min-w-0 shrink-0 flex-col rounded border border-dashed border-gray-200/80 bg-white/30 [min-width:2.5rem] dark:border-gray-600/50 dark:bg-gray-900/20 {editorTileInPlay(c.id)
                              ? 'editor-surface-in-play'
                              : ''}"
                            style="width: {wpx < 1 ? 40 : wpx}px;{rs > 1
                              ? ` min-height: ${Math.min(12, rs) * 2.25}rem;`
                              : ' min-height: 0;'}"
                            data-testid="editor-tile"
                            data-tile-id={c.id}
                          >
                            <p
                              class="{EDITOR_PLUGIN_HOVER_VISIBLE} min-h-0 truncate border-b border-gray-100/80 py-0.5 pl-1 pr-1 text-[10px] text-gray-400 dark:border-gray-700/80 dark:text-gray-500"
                              title={g.id}
                            >
                              {nestedContainerDisplayTitle(g.id)}
                            </p>
                            <div class="relative min-h-0 w-full min-w-0 flex-1">
                              <button
                                type="button"
                                class="{EDITOR_PLUGIN_HOVER_VISIBLE} {CHROME_DRAG_SM} text-emerald-600 dark:text-emerald-300"
                                aria-label="Drag to reorder tile in group"
                                use:dragHandle
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
                                    {@render renderTile(t)}
                                  {/snippet}
                                </TileEditChrome>
                              </div>
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
              class="{EDITOR_PLUGIN_HOVER_SHELL} relative flex h-full min-h-0 w-full max-w-full flex-col place-self-stretch rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 {editorTileInPlay(d.id)
                ? 'editor-surface-in-play'
                : ''} {paletteRootInsertPreview?.kind === 'before' && paletteRootInsertPreview.index === i
                ? 'editor-palette-root-insert-preview-before'
                : ''} {paletteRootInsertPreview?.kind === 'append' && i === dndRoot.length - 1
                ? 'editor-palette-root-insert-preview-after'
                : ''}"
              style={placed?.grid ? gridAreaStyle(placed.grid) : gridColumnSpanStyle(cv)}
              data-testid="editor-tile"
              data-tile-id={d.id}
            >
              {#if placed?.kind === "tile" && placed.grid}
                <p
                  class="{EDITOR_PLUGIN_HOVER_VISIBLE} min-h-0 border-b border-gray-100/80 truncate py-0.5 pl-1 pr-2 text-[10px] text-gray-400 dark:border-gray-700/80 dark:text-gray-500"
                  title="Span {placed.grid.colSpan}×{placed.grid.rowSpan} · row {placed.grid.row + 1}"
                >
                  Span {placed.grid.colSpan}×{placed.grid.rowSpan} · row {placed.grid.row + 1}
                </p>
              {/if}
              <div class="relative flex min-h-0 min-w-0 w-full flex-1 flex-col pt-0">
                <button
                  type="button"
                  class="{EDITOR_PLUGIN_HOVER_VISIBLE} {CHROME_DRAG_SM} text-emerald-600 dark:text-emerald-300"
                  aria-label="Drag to reorder tile"
                  data-testid="editor-tile-drag-handle"
                  use:dragHandle
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
                      {@render renderTile(cv)}
                    {/snippet}
                  </TileEditChrome>
                </div>
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
