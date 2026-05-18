<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { draggable, droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
  import Plus from "lucide-svelte/icons/plus";
  import Trash2 from "lucide-svelte/icons/trash-2";

  import type { PluginEntry } from "../../api/types";
  import DashboardReadNestedHost from "../pages/DashboardReadNestedHost.svelte";
  import TileEditChrome from "../tiles/TileEditChrome.svelte";
  import { groupOuterColSpan } from "../grid/gridPlacement";
  import { reorderByTarget } from "../interactions/dashboardSveltedndApply";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import {
    groupAppendContainer,
    groupChildSlotContainer,
    parseDragPayload,
    parseDropContainer,
    tabGroupTabsContainer,
    tabStripCellPayload,
  } from "../interactions/dashboardSveltedndTypes";
  import { editorDndDragAttrs as dndDragAttrs, editorDndDropAttrs as dndDropAttrs } from "../interactions/editorChrome";
  import { dedupeById } from "../layout/layoutTree";
  import type { DashboardGroup, DashboardTile, GroupChild } from "../types";
  import { isDashboardGroupNode, MAX_TAB_GROUP_CHILDREN } from "../types";
  import {
    createHostGroupStripDropCallbacks,
    isPaletteDragPayload,
  } from "./hostGroupDropCallbacks";
  import GroupHostPaneEditor from "./GroupHostPaneEditor.svelte";
  import type { HostPaneEditorBindings } from "./hostGroupPaneEditorTypes";
  import { hostGroupAppendDropContainer } from "./hostGroupPaneDrop";
  import TabGroupHost from "./TabGroupHost.svelte";
  import VerticalStackGroupHost from "./VerticalStackGroupHost.svelte";
  import {
    activeTabChild,
    addTabContainer,
    normalizeTabChildPaneGroups,
    removeTabChild,
    renameTabChild,
    reorderTabChildren,
    setActiveTab,
    tabStripLabel,
  } from "./tabGroupOps";

  let {
    group,
    editLayout = false,
    onGroupChange,
    layoutDropCb,
    paneEditor,
    tileContent,
    plugins = [] as PluginEntry[],
    onEditTile,
    onEditGroup,
  }: {
    group: DashboardGroup;
    editLayout?: boolean;
    onGroupChange?: (next: DashboardGroup) => void;
    /** Editor grid drop handler — palette drops on the tab strip delegate here (H3). */
    layoutDropCb?: {
      onDrop: (state: DragDropState<DashboardDragPayload>) => void;
      onDragOver: (state: DragDropState<DashboardDragPayload>) => void;
      onDragEnd: (state: DragDropState<DashboardDragPayload>) => void;
    };
    /** Drop surfaces inside each tab's panel (edit mode). */
    paneEditor?: HostPaneEditorBindings;
    tileContent: Snippet<[DashboardTile]>;
    plugins?: PluginEntry[];
    onEditTile?: (tile: DashboardTile) => void;
    onEditGroup?: (g: DashboardGroup) => void;
  } = $props();

  const children = $derived(dedupeById(group.children));
  /** Read mode without `onGroupChange` keeps selection local (strip still switches panes). */
  let localActiveId = $state<string | undefined>(undefined);
  const active = $derived.by(() => {
    if (onGroupChange) return activeTabChild(group);
    const id = localActiveId ?? group.hostState?.activeChildId;
    if (id != null && children.some((c) => c.id === id)) {
      return children.find((c) => c.id === id);
    }
    return activeTabChild(group);
  });
  const atMaxTabs = $derived(children.length >= MAX_TAB_GROUP_CHILDREN);

  let renamingId = $state<string | null>(null);
  let renameDraft = $state("");

  const noopLayoutDropCb = {
    onDrop: () => {},
    onDragOver: (state: DragDropState<DashboardDragPayload>) => {
      state.invalidDrop = false;
    },
    onDragEnd: () => {},
  };
  const tabStripDropCb = createHostGroupStripDropCallbacks(
    layoutDropCb ?? noopLayoutDropCb,
    onTabStripDrop,
  );

  /** Palette drops belong on the active tab pane (container), not the strip labels. */
  const readOnlyStripDroppable = {
    container: `g:${group.id}:strip-readonly`,
    direction: "horizontal" as const,
    callbacks: noopLayoutDropCb,
    attributes: dndDropAttrs,
  };

  const tabStripPaletteDropCb = {
    onDrop: (state: DragDropState<DashboardDragPayload>) => {
      const drag = parseDragPayload(state.draggedItem);
      const slot = parseDropContainer(state.targetContainer);
      if (isPaletteDragPayload(drag) && slot?.kind !== "groupAppend") return;
      tabStripDropCb.onDrop(state);
    },
    onDragOver: (state: DragDropState<DashboardDragPayload>) => {
      const drag = parseDragPayload(state.draggedItem);
      const slot = parseDropContainer(state.targetContainer);
      if (isPaletteDragPayload(drag) && slot?.kind !== "groupAppend") {
        state.invalidDrop = true;
        return;
      }
      tabStripDropCb.onDragOver(state);
    },
    onDragEnd: tabStripDropCb.onDragEnd,
  };

  $effect(() => {
    if (!editLayout || !onGroupChange) return;
    const normalized = normalizeTabChildPaneGroups(group);
    if (normalized !== group) commit(normalized);
  });

  function commit(next: DashboardGroup) {
    onGroupChange?.(next);
  }

  function selectTab(childId: string) {
    if (active?.id === childId) return;
    if (onGroupChange) {
      commit(setActiveTab(group, childId));
    } else {
      localActiveId = childId;
    }
  }

  function startRename(child: GroupChild) {
    renamingId = child.id;
    renameDraft = tabStripLabel(child);
  }

  function commitRename() {
    if (renamingId == null) return;
    const label = renameDraft.trim();
    if (label) commit(renameTabChild(group, renamingId, label));
    renamingId = null;
    renameDraft = "";
  }

  function cancelRename() {
    renamingId = null;
    renameDraft = "";
  }

  function deleteTab(childId: string) {
    if (children.length <= 1) return;
    const child = children.find((c) => c.id === childId);
    const label = child ? tabStripLabel(child) : childId;
    if (!window.confirm(`Remove tab “${label}”?`)) return;
    try {
      commit(removeTabChild(group, childId));
    } catch {
      /* last tab guarded above */
    }
  }

  function onAddTab() {
    if (atMaxTabs) return;
    try {
      commit(addTabContainer(group, { tabLabel: `Tab ${children.length + 1}` }));
    } catch {
      /* max tabs */
    }
  }

  function handleNestedGroupChange(nested: DashboardGroup) {
    const nextChildren = group.children.map((c) =>
      isDashboardGroupNode(c) && c.id === nested.id ? nested : c,
    );
    commit({ ...group, children: nextChildren });
  }

  function onTabStripDrop(state: DragDropState<DashboardDragPayload>) {
    if (state.invalidDrop) return;
    const drag = parseDragPayload(state.draggedItem);
    if (!drag || drag.k !== "tt" || drag.g !== group.id) return;
    const slot = parseDropContainer(state.targetContainer);
    if (!slot) return;
    let anchorId: string | null = null;
    let pos: "before" | "after" = state.dropPosition ?? "before";
    if (slot.kind === "groupChild" && slot.groupId === group.id) {
      anchorId = slot.childId;
    } else if (
      (slot.kind === "groupTabs" || slot.kind === "groupAppend") &&
      slot.groupId === group.id
    ) {
      anchorId = children[children.length - 1]?.id ?? null;
      pos = "after";
    }
    if (!anchorId || drag.i === anchorId) return;
    const reordered = reorderByTarget(children, drag.i, anchorId, pos);
    commit(reorderTabChildren(group, reordered.map((c) => c.id)));
  }
</script>

<div
  class="flex h-full min-h-0 w-full min-w-0 flex-col gap-2"
  data-dashboard-tab-group={group.id}
  data-testid="tab-group-host"
>
  <div
    class="flex min-w-0 flex-nowrap items-end gap-1 overflow-x-auto border-b border-slate-200/80 pb-px dark:border-gray-600/60"
    role="tablist"
    aria-label="Tabs for {group.id}"
    use:droppable={editLayout
      ? {
          container: tabGroupTabsContainer(group.id),
          direction: "horizontal",
          callbacks: tabStripPaletteDropCb,
          attributes: dndDropAttrs,
        }
      : readOnlyStripDroppable}
    data-dnd-container={editLayout ? tabGroupTabsContainer(group.id) : readOnlyStripDroppable.container}
    data-testid="tab-group-strip"
  >
    {#each children as child (child.id)}
      {@const activeId = active?.id}
      {@const isActive = child.id === activeId}
      <div
        class="group/tab flex shrink-0 items-center"
        use:droppable={editLayout
          ? {
              container: groupChildSlotContainer(group.id, child.id),
              direction: "horizontal",
              callbacks: tabStripPaletteDropCb,
              attributes: dndDropAttrs,
            }
          : readOnlyStripDroppable}
        data-dnd-container={editLayout
          ? groupChildSlotContainer(group.id, child.id)
          : readOnlyStripDroppable.container}
      >
        {#if editLayout && renamingId === child.id}
          <input
            type="text"
            class="min-w-[5rem] rounded-t-md border border-primary-400 bg-white px-2 py-1 text-xs dark:border-primary-500 dark:bg-gray-900"
            bind:value={renameDraft}
            data-testid="tab-rename-input"
            aria-label="Rename tab"
            onkeydown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelRename();
            }}
            onblur={commitRename}
          />
        {:else}
          <div
            role="tab"
            tabindex="0"
            aria-selected={isActive}
            class="flex max-w-[12rem] cursor-pointer items-center gap-1 rounded-t-md border border-b-0 px-2 py-1.5 text-xs font-medium transition-colors {isActive
              ? 'border-slate-200/90 bg-white text-slate-900 dark:border-gray-500/50 dark:bg-gray-900 dark:text-gray-100'
              : 'border-transparent bg-slate-50/80 text-slate-600 hover:bg-slate-100/90 dark:bg-gray-900/40 dark:text-gray-400 dark:hover:bg-gray-800/60'}"
            data-testid="tab-strip-item"
            data-tab-id={child.id}
            onclick={() => selectTab(child.id)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectTab(child.id);
              }
            }}
            ondblclick={() => editLayout && startRename(child)}
          >
            {#if editLayout}
              <span
                class="cursor-grab touch-none text-slate-400 active:cursor-grabbing"
                use:draggable={{
                  dragData: tabStripCellPayload(group.id, child.id),
                  container: tabGroupTabsContainer(group.id),
                  attributes: dndDragAttrs,
                }}
                data-testid="tab-strip-drag-handle"
                aria-hidden="true"
                onpointerdown={(e) => e.stopPropagation()}
              >
                <GripVertical class="h-3.5 w-3.5" />
              </span>
            {/if}
            <span class="truncate" data-testid="tab-strip-label">{tabStripLabel(child)}</span>
          </div>
          {#if editLayout}
            <button
              type="button"
              class="rounded p-0.5 text-slate-500 opacity-0 transition-opacity hover:bg-slate-200/80 group-hover/tab:opacity-100 dark:hover:bg-gray-700"
              aria-label="Rename tab"
              data-testid="tab-rename-button"
              onclick={() => startRename(child)}
            >
              <Pencil class="h-3 w-3" aria-hidden="true" />
            </button>
            {#if children.length > 1}
              <button
                type="button"
                class="rounded p-0.5 text-red-600/80 opacity-0 transition-opacity hover:bg-red-50 group-hover/tab:opacity-100 dark:text-red-400 dark:hover:bg-red-950/40"
                aria-label="Remove tab"
                data-testid="tab-delete-button"
                onclick={() => deleteTab(child.id)}
              >
                <Trash2 class="h-3 w-3" aria-hidden="true" />
              </button>
            {/if}
          {/if}
        {/if}
      </div>
    {/each}
    {#if editLayout}
      <div
        class="flex shrink-0 items-center gap-1 pb-0.5 pl-1"
        data-testid="tab-group-add"
        use:droppable={{
          container: hostGroupAppendDropContainer(group.id),
          direction: "horizontal",
          callbacks: tabStripPaletteDropCb,
          attributes: dndDropAttrs,
        }}
        data-dnd-container={groupAppendContainer(group.id)}
        data-editor-group-surface-drop="true"
      >
        <button
          type="button"
          class="flex items-center gap-0.5 rounded border border-slate-200/80 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          disabled={atMaxTabs}
          data-testid="tab-add-button"
          onclick={onAddTab}
        >
          <Plus class="h-3 w-3" aria-hidden="true" />
          Tab
        </button>
      </div>
    {/if}
  </div>

  <div
    class="tab-group-pane pointer-events-auto relative z-10 flex min-h-32 min-w-0 flex-1 flex-col overflow-hidden"
    role="tabpanel"
    aria-label={active ? tabStripLabel(active) : "Tab content"}
    data-testid="tab-group-pane"
  >
    {#if active}
      {#if isDashboardGroupNode(active)}
        {@const nested = active}
        {#if nested.hostControl === "tab-control"}
          <TabGroupHost
            group={nested}
            {editLayout}
            onGroupChange={handleNestedGroupChange}
            {layoutDropCb}
            {paneEditor}
            {tileContent}
            {plugins}
            {onEditTile}
            {onEditGroup}
          />
        {:else if nested.hostControl === "vertical-stack"}
          <VerticalStackGroupHost
            group={nested}
            {editLayout}
            onGroupChange={handleNestedGroupChange}
            {layoutDropCb}
            {paneEditor}
            {tileContent}
            {plugins}
            {onEditTile}
            {onEditGroup}
          />
        {:else if editLayout && paneEditor}
          <div class="relative z-[2] flex h-full min-h-0 min-w-0 flex-1 flex-col">
            {#key nested.id}
              <GroupHostPaneEditor paneGroup={nested} {editLayout} {paneEditor} {tileContent} />
            {/key}
          </div>
        {:else}
          <DashboardReadNestedHost
            group={nested}
            outerCols={groupOuterColSpan(nested)}
            {editLayout}
            {onEditTile}
            {tileContent}
          />
        {/if}
      {:else}
        {@const tile = active}
        <div class="flex h-full min-h-0 w-full min-w-0 flex-col" data-tile-id={tile.id}>
          <TileEditChrome {tile} onEdit={onEditTile} showEditButton={editLayout}>
            {#snippet children()}
              {@render tileContent(tile)}
            {/snippet}
          </TileEditChrome>
        </div>
      {/if}
    {/if}
  </div>
</div>
