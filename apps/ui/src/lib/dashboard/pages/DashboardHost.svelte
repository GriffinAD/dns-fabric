<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { dndState } from "@thisux/sveltednd";

  import type { PluginEntry } from "../../api/types";
  import { DataGateway } from "../../gateway/dataGateway";
  import type { FabricEventBus } from "../eventBus";
  import PluginPalette from "../../palette/PluginPalette.svelte";
  import {
    gridAreaStyle,
    gridColumnSpanStyle,
    groupGridAreaStyle,
    groupGridColumnSpanStyle,
    groupOuterColSpan,
    mergeRootLayoutGridsForEdit,
    packGroupChildrenRowWrapInOrder,
    reorderRootLayoutItemsPreservingSlotOrigins,
  } from "../grid/gridPlacement";
  import TabGroupHost from "../groups/TabGroupHost.svelte";
  import VerticalStackGroupHost from "../groups/VerticalStackGroupHost.svelte";
  import { addStackChild } from "../groups/verticalStackGroupOps";
  import { addTabChild } from "../groups/tabGroupOps";
  import DashboardReadNestedHost from "./DashboardReadNestedHost.svelte";
  import GroupReadNoWrap from "../tiles/GroupReadNoWrap.svelte";
  import PluginTileMount from "../tiles/PluginTileMount.svelte";
  import DashboardTileShell from "../DashboardTileShell.svelte";
  import TileEditChrome from "../tiles/TileEditChrome.svelte";
  import { buildRootLayoutFromDnd, type DashboardDndListItem } from "../grid/groupDndFinalize";
  import DashboardEditRootGrid from "./DashboardEditRootGrid.svelte";
  import {
    clearEditorDragHover,
    DND_CONTAINER_ATTR,
    getLastEditorDragClient,
    syncEditorDragHoverFromPointer,
  } from "../interactions/dashboardEditorDragHover";
  import { attachEditorPointerTracking } from "../interactions/editorPointerTracking";
  import { applyDashboardDrop, applyDashboardInvalidDrop } from "../interactions/dashboardSveltedndApply";
  import type { DashboardDropContext } from "../interactions/dashboardSveltedndApply";
  import { parseDragPayload, parseDropContainer, type DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import { editorGroupInPlay, editorTileInPlay } from "../interactions/editorSelection";
  import {
    DASHBOARD_GROUP_PANEL_SHELL,
    DASHBOARD_HOST_CONTROL_GROUP_SHELL,
    DASHBOARD_TAB_CONTROL_GROUP_SHELL,
  } from "../interactions/editorChrome";
  import { dedupeById, findGroupByIdInItems, mapLayoutReplaceGroupById } from "../layout/layoutTree";
  import { noWrapReadRowGroups } from "../layout/readModeLayout";
  import { stripScrollportObserve } from "../layout/stripWidth";
  import type {
    DashboardGroup,
    DashboardLayout,
    DashboardLayoutV3,
    DashboardTile,
    GroupChild,
    RootLayoutItem,
  } from "../types";
  import { isDashboardGroupNode } from "../types";

  type DndListItem = DashboardDndListItem;

  let {
    layout,
    gateway,
    bus,
    onEditTile,
    onEditGroup,
    editLayout = false,
    plugins = [] as PluginEntry[],
    onAddTile,
    onAddGroup,
    onAddTabGroup,
    onAddStackGroup,
    onAddGroupToGroup,
    onAddTabGroupToGroup,
    onAddStackGroupToGroup,
    onAddTileToGroup,
    onLayoutStructureChange,
    onPerfTileGridHint,
    onItemColSpanChange,
    activeEditorKind = null as "tile" | "group" | null,
    activeEditorId = null as string | null,
  }: {
    layout: DashboardLayoutV3;
    gateway: DataGateway;
    bus: FabricEventBus;
    onEditTile?: (tile: DashboardTile) => void;
    onEditGroup?: (g: DashboardGroup) => void;
    editLayout?: boolean;
    plugins?: PluginEntry[];
    onAddTile?: (pluginId: string, insertBeforeIndex?: number) => void;
    /** Add a new empty container on the root grid at index, or append when index is omitted. */
    onAddGroup?: (insertBeforeIndex?: number) => void;
    onAddTabGroup?: (insertBeforeIndex?: number) => void;
    onAddStackGroup?: (insertBeforeIndex?: number) => void;
    /** Add a new empty nested container inside an existing group (nowrap / nested-capable parents only). */
    onAddGroupToGroup?: (parentGroupId: string) => void;
    onAddTabGroupToGroup?: (parentGroupId: string) => void;
    onAddStackGroupToGroup?: (parentGroupId: string) => void;
    /** Drop a plugin from the palette onto a container in edit mode. */
    onAddTileToGroup?: (groupId: string, pluginId: string) => void;
    onLayoutStructureChange?: (next: DashboardLayout) => void;
    onPerfTileGridHint?: (tileId: string, hint: { colSpan: number; rowSpan: number }) => void;
    onItemColSpanChange?: (
      itemId: string,
      colSpan: number,
      phase: "preview" | "commit",
      groupId?: string,
    ) => void;
    /** Inspector / keyboard selection — drives `.editor-surface-in-play` on the matching tile or container. */
    activeEditorKind?: "tile" | "group" | null;
    activeEditorId?: string | null;
  } = $props();

  /** Passed to `DashboardEditRootGrid` — neutral glass; lateral/top via `--editor-chrome-*` on grid chrome. */
  const CHROME_DRAG_SM =
    "editor-chrome-drag editor-chrome-top absolute left-2 z-50 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-md border border-slate-200/80 bg-slate-50/95 shadow-sm backdrop-blur-[2px] focus-visible:ring-2 focus-visible:ring-primary-500/60 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-900/85 dark:hover:bg-gray-800";
  const CHROME_EDIT_SM =
    "editor-chrome-edit editor-chrome-top absolute right-2 z-50 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-slate-200/80 bg-slate-50/95 shadow-sm backdrop-blur-[2px] hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-500/60 dark:border-gray-600 dark:bg-gray-900/90 dark:hover:bg-gray-800";

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
    // Do not reset mirror lists mid-drag — sveltednd owns the in-flight item; resetting here
    // makes tiles vanish or jump when layout props tick during edit.
    if (dndState.isDragging) return;
    const items = layout.items;
    dndRoot = items.map((it) => rootItemToDnd(it));
    const next: Record<string, DndListItem[]> = {};
    for (const it of items) {
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

  /** True while @thisux/sveltednd reports an active drag (palette or grid). */
  const editorPointerDndActive = $derived(dndState.isDragging);

  const packedRoot = $derived(
    editLayout
      ? mergeRootLayoutGridsForEdit(layout.items, buildLayoutFromDnd())
      : reorderRootLayoutItemsPreservingSlotOrigins(layout.items, buildLayoutFromDnd()),
  );
  const rootPackedById = $derived(new Map(packedRoot.map((it) => [it.id, it])));

  /** Rely on `enabled` only: some API responses omit `ui_dashboard` and would hide the whole palette. */
  const palette = $derived(plugins.filter((p) => p.enabled));
  let dropCommittedForActiveDrag = $state(false);
  let pointerClient = $state<{ x: number; y: number } | undefined>(undefined);

  $effect(() => {
    if (!dndState.isDragging) {
      dropCommittedForActiveDrag = false;
    }
  });

  $effect(() => {
    if (!editorPointerDndActive) {
      pointerClient = undefined;
      return;
    }
    return attachEditorPointerTracking(
      true,
      {
        onPointer: (pt) => {
          pointerClient = pt;
        },
        onDragOver: (e) => {
          const drag = parseDragPayload(dndState.draggedItem);
          if (e.dataTransfer && (drag?.k === "pp" || drag?.k === "pg" || drag?.k === "pgt" || drag?.k === "pgs")) {
            e.dataTransfer.dropEffect = dndState.invalidDrop ? "none" : "copy";
          }
        },
        onDragEnd: () => clearEditorDragHover(),
      },
      { getDndRoot: () => dndRoot },
    );
  });

  function onAddTabToGroup(groupId: string, pluginId: string) {
    const group = findGroupByIdInItems(layout.items, groupId);
    if (!group || group.hostControl !== "tab-control") return;
    const tabLabel = plugins.find((p) => p.id === pluginId)?.name ?? pluginId;
    try {
      const next = addTabChild(group, { pluginId, tabLabel });
      onLayoutStructureChange?.({
        version: 3,
        items: mapLayoutReplaceGroupById(layout.items, groupId, next),
      });
    } catch {
      /* max tabs */
    }
  }

  function onAddStackToGroup(groupId: string, pluginId: string) {
    const group = findGroupByIdInItems(layout.items, groupId);
    if (!group || group.hostControl !== "vertical-stack") return;
    const sectionLabel = plugins.find((p) => p.id === pluginId)?.name ?? pluginId;
    try {
      const next = addStackChild(group, { pluginId, sectionLabel });
      onLayoutStructureChange?.({
        version: 3,
        items: mapLayoutReplaceGroupById(layout.items, groupId, next),
      });
    } catch {
      /* max sections */
    }
  }

  function buildDropContext(): DashboardDropContext {
    return {
      dndRoot,
      dndByGroup,
      layoutItems: layout.items,
      pointerClient,
      onLayoutStructureChange,
      onAddTile,
      onAddGroup,
      onAddTabGroup,
      onAddStackGroup,
      onAddTileToGroup,
      onAddTabToGroup,
      onAddStackToGroup,
      onAddGroupToGroup,
      onAddTabGroupToGroup,
      onAddStackGroupToGroup,
    };
  }

  function onLayoutDrop(state: DragDropState<DashboardDragPayload>) {
    const last = getLastEditorDragClient();
    if (last) {
      pointerClient = last;
      syncEditorDragHoverFromPointer(last.x, last.y, dndRoot);
    }
    applyDashboardInvalidDrop(state, dndRoot);
    if (state.invalidDrop) return;
    if (!state.targetContainer || !parseDropContainer(state.targetContainer)) return;
    if (last) {
      const hit = document.elementFromPoint(last.x, last.y);
      const overGrid = hit?.closest('[data-dashboard-editor="grid-chrome"]') != null;
      const overPalette = hit?.closest('[data-dashboard-editor="palette"]') != null;
      const overDropTarget = hit?.closest(`[${DND_CONTAINER_ATTR}]`) != null;
      // Floating palette can sit above the grid; still accept drops on tab/stack targets.
      if (!overGrid && overPalette && !overDropTarget) return;
    }
    if (dropCommittedForActiveDrag) return;
    dropCommittedForActiveDrag = true;
    const r = applyDashboardDrop(state, buildDropContext());
    if (r.nextDndRoot) dndRoot = dedupeById(r.nextDndRoot);
    if (r.nextDndByGroup) dndByGroup = { ...dndByGroup, ...r.nextDndByGroup };
  }

  function onDragOverLayout(state: DragDropState<DashboardDragPayload>) {
    applyDashboardInvalidDrop(state, dndRoot);
  }

  /** Drag ended without a committed drop — no layout mutation (cancel / release outside targets). */
  function onDragEndLayout(_state: DragDropState<DashboardDragPayload>) {
    dropCommittedForActiveDrag = false;
    clearEditorDragHover();
  }

  /** Viewport width for an editor “strip” (Auto wrap off) — same math as `GroupReadNoWrap` widthPx. */
  let noWrapEditPortW = $state<Record<string, number>>({});
  function noWrapStripPortMeasure(el: HTMLDivElement, gid: string) {
    return stripScrollportObserve(el, (w) => {
      noWrapEditPortW = { ...noWrapEditPortW, [gid]: w };
    });
  }

  function onTabGroupChange(next: DashboardGroup) {
    onLayoutStructureChange?.({
      version: 3,
      items: mapLayoutReplaceGroupById(layout.items, next.id, next),
    });
  }

</script>

{#snippet renderTile(tile: DashboardTile)}
  <PluginTileMount
    {gateway}
    {bus}
    {tile}
    {plugins}
    {editLayout}
    {onEditTile}
    {onPerfTileGridHint}
  />
{/snippet}

<div class="flex flex-col gap-4" data-testid="dashboard-host">
  {#if editLayout && (palette.length > 0 || onAddGroup || onAddTabGroup || onAddStackGroup)}
    <PluginPalette {plugins} {onAddTile} {onAddGroup} {onAddTabGroup} {onAddStackGroup} {gateway} {bus} />
  {/if}

  {#if editLayout}
    <DashboardEditRootGrid
      dndRoot={dndRoot}
      dndByGroup={dndByGroup}
      rootPackedById={rootPackedById}
      editorPointerDndActive={editorPointerDndActive}
      noWrapEditPortW={noWrapEditPortW}
      noWrapStripPortMeasure={noWrapStripPortMeasure}
      chromeDragSm={CHROME_DRAG_SM}
      chromeEditSm={CHROME_EDIT_SM}
      onLayoutDrop={onLayoutDrop}
      onDragOverLayout={onDragOverLayout}
      onDragEndLayout={onDragEndLayout}
      editorTileInPlay={(id) => editorTileInPlay(editLayout, activeEditorKind, activeEditorId, id)}
      editorGroupInPlay={(id) => editorGroupInPlay(editLayout, activeEditorKind, activeEditorId, id)}
      onAddTileToGroup={onAddTileToGroup}
      onAddGroupToGroup={onAddGroupToGroup}
      onEditGroup={onEditGroup}
      onTabGroupChange={onTabGroupChange}
      {plugins}
      {editLayout}
      {onEditTile}
      {onItemColSpanChange}
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
              ? it.hostControl === 'tab-control'
                ? DASHBOARD_TAB_CONTROL_GROUP_SHELL
                : it.hostControl === 'vertical-stack'
                  ? DASHBOARD_HOST_CONTROL_GROUP_SHELL
                  : DASHBOARD_GROUP_PANEL_SHELL
              : ''}"
            data-dashboard-group={it.id}
            data-host-control={it.hostControl}
            style={it.grid ? gridAreaStyle(it.grid) : ""}
            aria-label="Group {it.id}"
          >
            {#if it.hostControl === "tab-control"}
              <TabGroupHost
                group={it}
                {editLayout}
                onGroupChange={onTabGroupChange}
                {plugins}
                {onEditTile}
                onEditGroup={onEditGroup}
              >
                {#snippet tileContent(t)}
                  {@render renderTile(t)}
                {/snippet}
              </TabGroupHost>
            {:else if it.hostControl === "vertical-stack"}
              <VerticalStackGroupHost
                group={it}
                {editLayout}
                onGroupChange={onTabGroupChange}
                {plugins}
                {onEditTile}
                onEditGroup={onEditGroup}
              >
                {#snippet tileContent(t)}
                  {@render renderTile(t)}
                {/snippet}
              </VerticalStackGroupHost>
            {:else if it.innerWrap === true}
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
                  onGroupChange={onTabGroupChange}
                  {plugins}
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
          <div style={it.grid ? gridAreaStyle(it.grid) : gridColumnSpanStyle(it)}>
            <DashboardTileShell tile={it} elevated {editLayout} {onEditTile}>
              {@render renderTile(it)}
            </DashboardTileShell>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

</div>
