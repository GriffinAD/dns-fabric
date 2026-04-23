<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import {
    dragHandle,
    dragHandleZone,
    FEATURE_FLAG_NAMES,
    setFeatureFlag,
  } from "svelte-dnd-action";

  setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, true);

  import type { PluginEntry } from "../api/types";
  import { DataGateway } from "../dataGateway";
  import CpuTile from "../plugins/CpuTile.svelte";
  import DhcpClientsTile from "../plugins/DhcpClientsTile.svelte";
  import DhcpPoolsTile from "../plugins/DhcpPoolsTile.svelte";
  import DhcpReservationsTile from "../plugins/DhcpReservationsTile.svelte";
  import DiskTile from "../plugins/DiskTile.svelte";
  import DiscoveryTile from "../plugins/DiscoveryTile.svelte";
  import NwTile from "../plugins/NwTile.svelte";
  import PerfTile from "../plugins/PerfTile.svelte";
  import RamTile from "../plugins/RamTile.svelte";
  import {
    alignGaugeColumnCount,
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
  import GroupReadNoWrap from "./GroupReadNoWrap.svelte";
  import TileEditChrome from "./TileEditChrome.svelte";
  import { dedupeById } from "./layoutTree";
  import type { DashboardGroup, DashboardLayout, DashboardLayoutV2, DashboardTile, RootLayoutItem } from "./types";

  const DND_PLUGIN_MIME = "application/x-kea-plugin-id";
  const DND_LAYOUT_DND = "application/x-kea-fabric-layout-dnd";
  const DND_ADD_GROUP = "add-group";
  /** `text/plain` is required for reliable drop payload in Safari and some Chrome builds. */
  const PLAIN_ADD_GROUP = "x-kea-fabric:layout-add-group";
  const PLAIN_PLUGIN_PREFIX = "x-kea-fabric:plugin:";

  type PaletteDrag = { kind: "group" } | { kind: "plugin"; id: string };

  function setPalettePluginDragData(e: DragEvent, pluginId: string) {
    const t = `${PLAIN_PLUGIN_PREFIX}${pluginId}`;
    e.dataTransfer?.setData("text/plain", t);
    e.dataTransfer?.setData(DND_PLUGIN_MIME, pluginId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  }

  function setPaletteAddGroupDragData(e: DragEvent) {
    e.dataTransfer?.setData("text/plain", PLAIN_ADD_GROUP);
    e.dataTransfer?.setData(DND_LAYOUT_DND, DND_ADD_GROUP);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  }

  function readPaletteDragPayload(dt: DataTransfer | null): PaletteDrag | null {
    if (!dt) return null;
    if (dt.getData(DND_LAYOUT_DND) === DND_ADD_GROUP) return { kind: "group" };
    const mimeP = dt.getData(DND_PLUGIN_MIME);
    if (mimeP) return { kind: "plugin", id: mimeP };
    const plain = dt.getData("text/plain").trim();
    if (plain === PLAIN_ADD_GROUP) return { kind: "group" };
    if (plain.startsWith(PLAIN_PLUGIN_PREFIX)) {
      return { kind: "plugin", id: plain.slice(PLAIN_PLUGIN_PREFIX.length) };
    }
    return null;
  }

  /** svelte-dnd-action zone type — one shared value so root ↔ container moves are allowed. */
  const SVELTE_DND_TYPE_DASHBOARD = "dashboard-layout";
  type DndListItem = { id: string; item: RootLayoutItem };

  let {
    layout,
    gateway,
    liveCpuPercent,
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
    layout: DashboardLayoutV2;
    gateway: DataGateway;
    liveCpuPercent?: number | null;
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

  function tileToDndListItem(t: DashboardTile): DndListItem {
    return { id: t.id, item: { kind: "tile" as const, ...t } };
  }

  function dndListItemToDashboardTile(c: DndListItem): DashboardTile {
    if (c.item.kind !== "tile") {
      throw new Error("expected a tile in group DnD list");
    }
    const { kind: _k, ...tile } = c.item;
    return tile;
  }

  $effect(() => {
    dndRoot = layout.items.map((it) => ({ id: it.id, item: it }));
    const next: Record<string, DndListItem[]> = {};
    for (const it of layout.items) {
      if (it.kind === "group") {
        next[it.id] = dedupeById(it.children).map((t) => tileToDndListItem(t));
      }
    }
    dndByGroup = next;
  });

  /** Merges per-group DnD lists with root so packed preview matches in-flight cross-zone drags. */
  function buildV2FromDnd(): RootLayoutItem[] {
    return dndRoot.map((row) => {
      const it = row.item;
      if (it.kind === "group") {
        const prevG = layout.items.find(
          (p) => p.kind === "group" && p.id === it.id,
        ) as DashboardGroup | undefined;
        if (!prevG) {
          return it;
        }
        const list = dndByGroup[it.id] ?? prevG.children.map((t) => tileToDndListItem(t));
        const reordered: DashboardTile[] = dedupeById(
          list
            .filter((c) => c.item.kind === "tile")
            .map((c) => dndListItemToDashboardTile(c)),
        );
        const nextChildren = applyGroupDndList(prevG, reordered);
        return { ...prevG, children: nextChildren } satisfies RootLayoutItem;
      }
      return { ...it };
    });
  }

  function commitDndToLayout() {
    const next = reorderRootLayoutItemsPreservingSlotOrigins(layout.items, buildV2FromDnd());
    onLayoutStructureChange?.({ version: 2, items: next });
  }

  const packedRoot = $derived(
    reorderRootLayoutItemsPreservingSlotOrigins(layout.items, buildV2FromDnd()),
  );
  const rootPackedById = $derived(new Map(packedRoot.map((it) => [it.id, it])));

  /** Rely on `enabled` only: some API responses omit `ui_dashboard` and would hide the whole palette. */
  const palette = $derived(plugins.filter((p) => p.enabled));
  const flipDurationMs = 180;

  /** Viewport width for an editor “strip” (Auto wrap off) — same math as `GroupReadNoWrap` widthPx. */
  let noWrapEditPortW = $state<Record<string, number>>({});
  function noWrapStripPortMeasure(el: HTMLDivElement, gid: string) {
    const set = () => {
      const w = el.clientWidth;
      noWrapEditPortW = { ...noWrapEditPortW, [gid]: w };
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return { destroy: () => ro.disconnect() };
  }

  /**
   * `innerWrap`: pack in DnD list order. Otherwise preserve slot remapping (no `packTilesToGrid`,
   * which would force extra rows and break "no wrap" + horizontal scroll in read view).
   */
  function applyGroupDndList(g: DashboardGroup, reordered: DashboardTile[]): DashboardTile[] {
    if (g.innerWrap === true) {
      return packGroupChildrenRowWrapInOrder(reordered, groupOuterColSpan(g));
    }
    return reorderTilesPreservingSlotOrigins(g.children, reordered, false);
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

  function handleRootConsider(e: CustomEvent<{ items: DndListItem[] }>) {
    dndRoot = dedupeById(e.detail.items);
  }

  function handleRootFinalize(e: CustomEvent<{ items: DndListItem[] }>) {
    dndRoot = dedupeById(e.detail.items);
    queueMicrotask(() => {
      if (!onLayoutStructureChange) return;
      commitDndToLayout();
    });
  }

  function handleGroupConsider(gid: string) {
    return (e: CustomEvent<{ items: DndListItem[] }>) => {
      const items = dedupeById(e.detail.items.filter((x) => x.item.kind === "tile"));
      dndByGroup = { ...dndByGroup, [gid]: items };
    };
  }

  function handleGroupFinalize(gid: string) {
    return (e: CustomEvent<{ items: DndListItem[] }>) => {
      const items = dedupeById(e.detail.items.filter((x) => x.item.kind === "tile"));
      dndByGroup = { ...dndByGroup, [gid]: items };
      queueMicrotask(() => {
        if (!onLayoutStructureChange) return;
        commitDndToLayout();
      });
    };
  }

  function onPaletteDragStart(e: DragEvent, pluginId: string) {
    setPalettePluginDragData(e, pluginId);
  }

  function onPaletteDragStartAddGroup(e: DragEvent) {
    setPaletteAddGroupDragData(e);
  }

  function onCanvasDrop(e: DragEvent) {
    e.preventDefault();
    const p = readPaletteDragPayload(e.dataTransfer);
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
    const p = readPaletteDragPayload(e.dataTransfer);
    if (p?.kind === "plugin") {
      e.stopPropagation();
      onAddTileToGroup?.(groupId, p.id);
    }
  }
</script>

{#snippet renderTile(tile: DashboardTile, inGroup: boolean)}
  {@const ac = alignGaugeColumnCount(null, tile)}
  {#if tile.pluginId === "dhcp.pools"}
    <DhcpPoolsTile {gateway} {tile} />
  {:else if tile.pluginId === "dhcp.clients"}
    <DhcpClientsTile {gateway} {tile} />
  {:else if tile.pluginId === "dhcp.reservations"}
    <DhcpReservationsTile {gateway} {tile} />
  {:else if tile.pluginId === "discovery.records"}
    <DiscoveryTile
      {gateway}
      {tile}
      onOpenSettings={editLayout && onEditTile ? () => onEditTile(tile) : undefined}
    />
  {:else if tile.pluginId === "perf.summary"}
    <PerfTile
      {gateway}
      {tile}
      {liveCpuPercent}
      alignColumnCount={inGroup ? 12 : ac}
      dashboardGaugeAlign={!inGroup}
    />
  {:else if tile.pluginId === "perf.cpu"}
    <CpuTile
      {gateway}
      {tile}
      {liveCpuPercent}
      alignColumnCount={inGroup ? 12 : ac}
      dashboardGaugeAlign={!inGroup}
      onGridHint={onPerfTileGridHint ? (hint) => onPerfTileGridHint(tile.id, hint) : undefined}
    />
  {:else if tile.pluginId === "perf.ram"}
    <RamTile
      {gateway}
      {tile}
      alignColumnCount={inGroup ? 12 : ac}
      dashboardGaugeAlign={!inGroup}
      onGridHint={onPerfTileGridHint ? (hint) => onPerfTileGridHint(tile.id, hint) : undefined}
    />
  {:else if tile.pluginId === "perf.network"}
    <NwTile
      {gateway}
      {tile}
      alignColumnCount={inGroup ? 12 : ac}
      dashboardGaugeAlign={!inGroup}
      onGridHint={onPerfTileGridHint ? (hint) => onPerfTileGridHint(tile.id, hint) : undefined}
    />
  {:else if tile.pluginId === "perf.disk"}
    <DiskTile
      {gateway}
      {tile}
      alignColumnCount={inGroup ? 12 : ac}
      dashboardGaugeAlign={!inGroup}
      onGridHint={onPerfTileGridHint ? (hint) => onPerfTileGridHint(tile.id, hint) : undefined}
    />
  {:else}
    <Card
      size="xl"
      class="box-border !max-w-full w-full min-w-0 flex-1 min-h-0 flex-col"
    >
      {#snippet children()}
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{tile.pluginId}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">Unknown plugin (placeholder).</p>
      {/snippet}
    </Card>
  {/if}
{/snippet}

<div class="flex flex-col gap-4" data-testid="dashboard-host">
  {#if editLayout && (palette.length > 0 || onAddGroup)}
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
        <!-- Native <button> so click + HTML5 drag work reliably; Flowbite svelte:element was dropping handlers. -->
        {#if onAddGroup}
          <button
            type="button"
            draggable="true"
            class="cursor-grab select-none rounded-lg border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:bg-primary-500 dark:hover:bg-primary-600"
            data-testid="layout-add-container"
            ondragstart={(e: DragEvent) => onPaletteDragStartAddGroup(e)}
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
            ondragstart={(e: DragEvent) => onPaletteDragStart(e, p.id)}
            onclick={() => onAddTile?.(p.id)}
          >
            Add {p.name}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if editLayout}
    <div
      class="relative min-h-[120px] overflow-hidden rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600"
      data-testid="editor-grid-chrome"
      role="region"
      aria-label="Drop plugins or a new container onto the grid"
      ondragover={onEditorChromeDragOver}
      ondrop={onCanvasDrop}
    >
      <div
        class="relative grid min-h-[120px] w-full auto-rows-[minmax(0,auto)] grid-cols-12 content-start place-items-stretch pb-[min(50vh,40rem)]"
        data-testid="editor-drop-zone"
        role="group"
        aria-label="Dashboard tile grid"
        use:dragHandleZone={{
          items: dndRoot,
          flipDurationMs,
          type: SVELTE_DND_TYPE_DASHBOARD,
          autoAriaDisabled: true,
          morphDisabled: true,
          dropTargetStyle: { outline: "none" },
        }}
        onconsider={handleRootConsider}
        onfinalize={handleRootFinalize}
      >
        {#each dndRoot as d (d.id)}
          {@const placed = rootPackedById.get(d.id)}
          {@const g = d.item.kind === "group" ? d.item : null}
          {@const cv = d.item.kind === "tile" ? d.item : null}
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
                        flipDurationMs: 0,
                        type: SVELTE_DND_TYPE_DASHBOARD,
                        autoAriaDisabled: true,
                        morphDisabled: true,
                        dropAnimationDisabled: true,
                        dropTargetStyle: { outline: "none" },
                      }}
                      onconsider={handleGroupConsider(g.id)}
                      onfinalize={handleGroupFinalize(g.id)}
                    >
                      {#each gItems as c (c.id)}
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
                        flipDurationMs: 0,
                        type: SVELTE_DND_TYPE_DASHBOARD,
                        autoAriaDisabled: true,
                        morphDisabled: true,
                        dropAnimationDisabled: true,
                        dropTargetStyle: { outline: "none" },
                      }}
                      onconsider={handleGroupConsider(g.id)}
                      onfinalize={handleGroupFinalize(g.id)}
                    >
                      {#each gItems as c (c.id)}
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
      class="grid w-full auto-rows-[minmax(0,auto)] grid-cols-12 content-start place-items-stretch"
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
              {@const packed = dedupeById(
                packGroupChildrenRowWrapInOrder(dedupeById(it.children), Gr),
              )}
              <div
                class="grid h-full w-full min-h-0 min-w-0 auto-rows-[minmax(0,auto)] content-start gap-2 [box-sizing:border-box] [min-width:0] [place-self:stretch] [align-self:stretch] [overflow:visible]"
                style="grid-template-columns: repeat({Gr}, minmax(0, 1fr));"
              >
                {#each packed as tile (tile.id)}
                  <div
                    class="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col place-self-stretch"
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
              <GroupReadNoWrap
                rowGroups={noWrapReadRowGroups(it.children)}
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
          </div>
        {:else}
          <div
            class="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col place-self-stretch"
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
