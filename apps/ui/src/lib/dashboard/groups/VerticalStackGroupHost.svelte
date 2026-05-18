<script lang="ts">
  import { droppable } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import Pencil from "lucide-svelte/icons/pencil";
  import Plus from "lucide-svelte/icons/plus";
  import Trash2 from "lucide-svelte/icons/trash-2";

  import type { PluginEntry } from "../../api/types";
  import DashboardReadNestedHost from "../pages/DashboardReadNestedHost.svelte";
  import TileEditChrome from "../tiles/TileEditChrome.svelte";
  import { groupOuterColSpan } from "../grid/gridPlacement";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import {
    groupAppendContainer,
    groupChildSlotContainer,
  } from "../interactions/dashboardSveltedndTypes";
  import { editorDndDropAttrs as dndDropAttrs } from "../interactions/editorChrome";
  import { dedupeById } from "../layout/layoutTree";
  import type { DashboardGroup, DashboardTile, GroupChild } from "../types";
  import { isDashboardGroupNode, MAX_TAB_GROUP_CHILDREN } from "../types";
  import { createHostGroupStripDropCallbacks } from "./hostGroupDropCallbacks";
  import GroupHostPaneEditor from "./GroupHostPaneEditor.svelte";
  import type { HostPaneEditorBindings } from "./hostGroupPaneEditorTypes";
  import { hostGroupAppendDropContainer } from "./hostGroupPaneDrop";
  import TabGroupHost from "./TabGroupHost.svelte";
  import VerticalStackGroupHost from "./VerticalStackGroupHost.svelte";
  import {
    addStackChild,
    addStackSection,
    isStackSectionCollapsed,
    removeStackChild,
    renameStackChild,
    stackSectionLabel,
    toggleStackSectionCollapsed,
  } from "./verticalStackGroupOps";

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
    layoutDropCb?: {
      onDrop: (state: import("@thisux/sveltednd").DragDropState<DashboardDragPayload>) => void;
      onDragOver: (state: import("@thisux/sveltednd").DragDropState<DashboardDragPayload>) => void;
      onDragEnd: (state: import("@thisux/sveltednd").DragDropState<DashboardDragPayload>) => void;
    };
    paneEditor?: HostPaneEditorBindings;
    tileContent: Snippet<[DashboardTile]>;
    plugins?: PluginEntry[];
    onEditTile?: (tile: DashboardTile) => void;
    onEditGroup?: (g: DashboardGroup) => void;
  } = $props();

  const children = $derived(dedupeById(group.children));
  const palette = $derived(plugins.filter((p) => p.enabled));
  const atMaxSections = $derived(children.length >= MAX_TAB_GROUP_CHILDREN);

  let renamingId = $state<string | null>(null);
  let renameDraft = $state("");
  let addPluginPick = $state("");

  function commit(next: DashboardGroup) {
    onGroupChange?.(next);
  }

  function startRename(child: GroupChild) {
    renamingId = child.id;
    renameDraft = stackSectionLabel(child);
  }

  function commitRename() {
    if (renamingId == null) return;
    const label = renameDraft.trim();
    if (label) commit(renameStackChild(group, renamingId, label));
    renamingId = null;
    renameDraft = "";
  }

  function cancelRename() {
    renamingId = null;
    renameDraft = "";
  }

  function deleteSection(childId: string) {
    if (children.length <= 1) return;
    const child = children.find((c) => c.id === childId);
    const label = child ? stackSectionLabel(child) : childId;
    if (!window.confirm(`Remove section “${label}”?`)) return;
    try {
      commit(removeStackChild(group, childId));
    } catch {
      /* guarded */
    }
  }

  function onAddPluginSection() {
    if (!addPluginPick || atMaxSections) return;
    const entry = palette.find((p) => p.id === addPluginPick);
    if (!entry) return;
    try {
      commit(addStackChild(group, { pluginId: entry.id, sectionLabel: entry.name }));
      addPluginPick = "";
    } catch {
      /* max sections */
    }
  }

  function onAddNestedSection() {
    if (atMaxSections) return;
    try {
      commit(addStackSection(group, { sectionLabel: "Section" }));
    } catch {
      /* max sections */
    }
  }

  function handleNestedGroupChange(nested: DashboardGroup) {
    const nextChildren = group.children.map((c) =>
      isDashboardGroupNode(c) && c.id === nested.id ? nested : c,
    );
    commit({ ...group, children: nextChildren });
  }

  const noopLayoutDropCb = {
    onDrop: () => {},
    onDragOver: (state: import("@thisux/sveltednd").DragDropState<DashboardDragPayload>) => {
      state.invalidDrop = false;
    },
    onDragEnd: () => {},
  };
  const stackDropCb = createHostGroupStripDropCallbacks(layoutDropCb ?? noopLayoutDropCb);

</script>

<div
  class="flex h-full min-h-0 w-full min-w-0 flex-col gap-2"
  data-dashboard-stack-group={group.id}
  data-testid="vertical-stack-group-host"
>
  {#snippet stackSectionInner(child: GroupChild, collapsed: boolean)}
      <div class="group/section flex shrink-0 items-center gap-1 border-b border-slate-200/70 px-2 py-1 dark:border-gray-600/50">
        <button
          type="button"
          class="rounded p-0.5 text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand section" : "Collapse section"}
          data-testid="stack-section-toggle"
          onclick={() => commit(toggleStackSectionCollapsed(group, child.id))}
        >
          {#if collapsed}
            <ChevronRight class="h-4 w-4" aria-hidden="true" />
          {:else}
            <ChevronDown class="h-4 w-4" aria-hidden="true" />
          {/if}
        </button>
        {#if editLayout && renamingId === child.id}
          <input
            type="text"
            class="min-w-0 flex-1 rounded border border-primary-400 bg-white px-2 py-0.5 text-xs dark:border-primary-500 dark:bg-gray-900"
            bind:value={renameDraft}
            data-testid="stack-section-rename-input"
            aria-label="Rename section"
            onkeydown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelRename();
            }}
            onblur={commitRename}
          />
        {:else}
          <span class="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-gray-100" data-testid="stack-section-label">
            {stackSectionLabel(child)}
          </span>
        {/if}
        {#if editLayout}
          <button
            type="button"
            class="rounded p-0.5 text-slate-500 opacity-0 transition-opacity hover:bg-slate-200/80 group-hover/section:opacity-100 dark:hover:bg-gray-700"
            aria-label="Rename section"
            data-testid="stack-section-rename-button"
            onclick={() => startRename(child)}
          >
            <Pencil class="h-3 w-3" aria-hidden="true" />
          </button>
          {#if children.length > 1}
            <button
              type="button"
              class="rounded p-0.5 text-red-600/80 opacity-0 transition-opacity hover:bg-red-50 group-hover/section:opacity-100 dark:text-red-400 dark:hover:bg-red-950/40"
              aria-label="Remove section"
              data-testid="stack-section-delete-button"
              onclick={() => deleteSection(child.id)}
            >
              <Trash2 class="h-3 w-3" aria-hidden="true" />
            </button>
          {/if}
        {/if}
      </div>
      {#if !collapsed}
        <div class="flex min-h-32 min-w-0 flex-1 flex-col overflow-hidden p-2" data-testid="stack-section-body">
          {#if isDashboardGroupNode(child)}
            {@const nested = child}
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
              {#key nested.id}
                <GroupHostPaneEditor paneGroup={nested} {editLayout} {paneEditor} {tileContent} />
              {/key}
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
            {@const tile = child}
            <div class="flex h-full min-h-0 w-full min-w-0 flex-col" data-tile-id={tile.id}>
              <TileEditChrome {tile} onEdit={onEditTile} showEditButton={editLayout}>
                {#snippet children()}
                  {@render tileContent(tile)}
                {/snippet}
              </TileEditChrome>
            </div>
          {/if}
        </div>
      {/if}
  {/snippet}

  {#each children as child (child.id)}
    {@const collapsed = isStackSectionCollapsed(group, child.id)}
    {#if editLayout}
      <section
        class="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-200/80 bg-white/40 dark:border-gray-600/60 dark:bg-gray-900/30"
        data-testid="stack-section"
        data-section-id={child.id}
        use:droppable={{
          container: groupChildSlotContainer(group.id, child.id),
          direction: "horizontal",
          callbacks: stackDropCb,
          attributes: dndDropAttrs,
        }}
        data-dnd-container={groupChildSlotContainer(group.id, child.id)}
        data-editor-group-surface-drop="true"
      >
        {@render stackSectionInner(child, collapsed)}
      </section>
    {:else}
      <section
        class="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-200/80 bg-white/40 dark:border-gray-600/60 dark:bg-gray-900/30"
        data-testid="stack-section"
        data-section-id={child.id}
      >
        {@render stackSectionInner(child, collapsed)}
      </section>
    {/if}
  {/each}
  {#if editLayout}
    <div
      class="flex shrink-0 flex-wrap items-center gap-1 rounded-md border border-dashed border-slate-300/90 px-2 py-1.5 dark:border-gray-600"
      data-testid="stack-group-add"
      use:droppable={{
        container: hostGroupAppendDropContainer(group.id),
        direction: "horizontal",
        callbacks: stackDropCb,
        attributes: dndDropAttrs,
      }}
      data-dnd-container={groupAppendContainer(group.id)}
      data-editor-group-surface-drop="true"
    >
      <label class="sr-only" for="stack-add-plugin-{group.id}">Add plugin section</label>
      <select
        id="stack-add-plugin-{group.id}"
        class="max-w-[8rem] rounded border border-slate-200/80 bg-white px-1 py-1 text-[10px] dark:border-gray-600 dark:bg-gray-900"
        bind:value={addPluginPick}
        disabled={atMaxSections || palette.length === 0}
        data-testid="stack-add-plugin-select"
      >
        <option value="">+ Section…</option>
        {#each palette as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
      <button
        type="button"
        class="flex items-center gap-0.5 rounded border border-slate-200/80 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        disabled={!addPluginPick || atMaxSections}
        data-testid="stack-add-plugin-confirm"
        onclick={onAddPluginSection}
      >
        <Plus class="h-3 w-3" aria-hidden="true" />
        Plugin
      </button>
      <button
        type="button"
        class="flex items-center gap-0.5 rounded border border-dashed border-slate-300/90 px-1.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
        disabled={atMaxSections}
        data-testid="stack-add-nested-section"
        onclick={onAddNestedSection}
      >
        <Plus class="h-3 w-3" aria-hidden="true" />
        Container
      </button>
    </div>
  {/if}
</div>
