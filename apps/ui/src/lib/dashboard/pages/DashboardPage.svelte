<script lang="ts">
  import { get } from "svelte/store";

  import Button from "flowbite-svelte/Button.svelte";

  import type { PluginEntry } from "../../api/types";
  import type { DataGateway } from "../../gateway/dataGateway";
  import DashboardToolbar from "../editor/DashboardToolbar.svelte";
  import InspectorPanel from "../editor/InspectorPanel.svelte";
  import { editorSelection } from "../editor/editorState";
  import DashboardHost from "./DashboardHost.svelte";
  import GroupSettingsOverlay from "../tiles/GroupSettingsOverlay.svelte";
  import TileSettingsOverlay from "../tiles/TileSettingsOverlay.svelte";
  import {
    groupOuterColSpan,
    resizeGroupChildTileColSpan,
    resizeRootLayoutItemColSpan,
  } from "../grid/gridPlacement";
  import type { LayoutStore } from "../layout/layoutStore";
  import { collectAllGroupsInLayout, findTileInLayout, PARENT_ID_DASHBOARD } from "../layout/layoutTree";
  import { clearStoredDashboardLayoutAndUnlock } from "../layout/layoutStorage";
  import type { OverlayActions } from "../layout/overlayActions";
  import type { DashboardGroup, DashboardLayoutV3, DashboardTile } from "../types";

  let {
    gateway,
    plugins,
    layout,
    editLayout,
    loadError,
    persistError,
    localPersistBlocked,
    localPersistBlockedReason,
    settingsTile,
    settingsGroup,
    ls,
    overlay,
    onPerfTileGridHint,
    hideEditorToolbar = false,
  }: {
    gateway: DataGateway;
    plugins: PluginEntry[];
    layout: DashboardLayoutV3;
    editLayout: boolean;
    loadError: string | null;
    persistError: string | null;
    localPersistBlocked: boolean;
    localPersistBlockedReason: string | null;
    settingsTile: DashboardTile | null;
    settingsGroup: DashboardGroup | null;
    ls: LayoutStore;
    overlay: OverlayActions;
    onPerfTileGridHint: (tileId: string, hint: { colSpan: number; rowSpan: number }) => void;
    /** When true, undo/redo live in an external chrome (e.g. Pi-hole CP sticky header). */
    hideEditorToolbar?: boolean;
  } = $props();

  const settingsParentId = $derived.by(() => {
    if (!settingsTile) return PARENT_ID_DASHBOARD;
    const f = findTileInLayout(layout.items, settingsTile.id);
    return f?.inGroup ? f.inGroup.id : PARENT_ID_DASHBOARD;
  });

  const settingsTileContainerG = $derived.by(() => {
    if (!settingsTile) return null;
    const f = findTileInLayout(layout.items, settingsTile.id);
    return f?.inGroup != null ? groupOuterColSpan(f.inGroup) : null;
  });

  const parentOptions = $derived([
    { value: PARENT_ID_DASHBOARD, label: "Dashboard (root)" },
    ...collectAllGroupsInLayout(layout.items).map((g) => ({ value: g.id, label: `Container: ${g.id}` })),
  ]);

  const tileSettingsContainerMeta = $derived(
    collectAllGroupsInLayout(layout.items).map((g) => ({ id: g.id, innerWrap: g.innerWrap === true })),
  );

  function onEditTile(tile: DashboardTile) {
    editorSelection.set({ kind: "tile", id: tile.id, label: tile.pluginId });
    overlay.openTileSettings(tile);
  }

  function onItemColSpanChange(
    itemId: string,
    colSpan: number,
    phase: "preview" | "commit",
    groupId?: string,
  ) {
    const items = get(ls.layout).items;
    const nextItems = groupId
      ? resizeGroupChildTileColSpan(items, groupId, itemId, colSpan)
      : resizeRootLayoutItemColSpan(items, itemId, colSpan);
    ls.applyStructure(
      { version: 3, items: nextItems },
      { preserveRootPlacementIfComplete: true, skipHistory: phase === "preview" },
    );
  }

  function onEditGroup(g: DashboardGroup) {
    editorSelection.set({ kind: "group", id: g.id, label: g.id });
    overlay.openGroupSettings(g);
  }

  function isEditableTarget(node: EventTarget | null): boolean {
    if (!(node instanceof HTMLElement)) return false;
    if (node.isContentEditable) return true;
    if (node.closest("[contenteditable='true']")) return true;
    const t = node.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
  }

  function removeTileFromSettings() {
    const st = settingsTile;
    if (!st) return;
    const f = findTileInLayout(layout.items, st.id);
    if (f?.inGroup) {
      overlay.deleteGroupChildTile(f.inGroup.id, st.id);
    } else {
      overlay.deleteRootLayoutItem(st.id);
    }
    overlay.closeTileSettings();
  }

  function removeGroupFromSettings() {
    const sg = settingsGroup;
    if (!sg) return;
    const isRoot = layout.items.some((it) => it.kind === "group" && it.id === sg.id);
    if (isRoot) {
      overlay.deleteRootLayoutItem(sg.id);
    } else {
      overlay.deleteLayoutGroupById(sg.id);
    }
    overlay.closeGroupSettings();
  }

  function handleEditorDeleteKey(e: KeyboardEvent) {
    if (e.key !== "Delete" || e.repeat) return;
    // Modal dialogs own their own keyboard UX; don't let global editor shortcuts fire there.
    if (settingsTile || settingsGroup) return;
    if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
    if (!editLayout) return;
    const sel = get(editorSelection);
    if (!sel) return;
    e.preventDefault();
    if (sel.kind === "tile") {
      const f = findTileInLayout(layout.items, sel.id);
      if (f?.inGroup) {
        overlay.deleteGroupChildTile(f.inGroup.id, sel.id);
      } else {
        overlay.deleteRootLayoutItem(sel.id);
      }
      editorSelection.set(null);
      return;
    }
    const isRoot = layout.items.some((it) => it.kind === "group" && it.id === sel.id);
    if (isRoot) {
      overlay.deleteRootLayoutItem(sel.id);
    } else {
      overlay.deleteLayoutGroupById(sel.id);
    }
    editorSelection.set(null);
  }
</script>

<svelte:window onkeydown={handleEditorDeleteKey} />

{#if loadError}
  <p class="text-red-600 dark:text-red-400" role="alert">{loadError}</p>
{:else}
  {#if localPersistBlocked && localPersistBlockedReason}
    <div
      class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
      role="alert"
      data-testid="layout-local-persist-blocked"
    >
      <p class="font-medium">Incompatible stored layout</p>
      <p class="mt-1">{localPersistBlockedReason}</p>
      <p class="mt-1 text-xs opacity-90">
        Local layout cache is read-only until you clear it or replace it from the server (e.g. Reset).
      </p>
      <Button
        type="button"
        color="alternative"
        class="mt-2"
        onclick={() => {
          clearStoredDashboardLayoutAndUnlock();
          window.location.reload();
        }}
      >
        Clear stored layout and reload
      </Button>
    </div>
  {/if}
  {#if persistError}
    <p
      class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
      role="status"
    >
      Could not save layout to the server: {persistError}
    </p>
  {/if}
  <div class="flex flex-col gap-4">
    {#if editLayout && !hideEditorToolbar}
      <div class="shrink-0 self-start">
        <DashboardToolbar {ls} />
      </div>
    {/if}
    <div class="min-w-0 w-full flex-1">
      <DashboardHost
        {layout}
        {gateway}
        {plugins}
        {editLayout}
        activeEditorKind={$editorSelection?.kind ?? null}
        activeEditorId={$editorSelection?.id ?? null}
        onAddTile={ls.addRootTile}
        onAddGroup={ls.addGroup}
        onAddGroupToGroup={ls.addGroupToParent}
        onAddTileToGroup={ls.addTileToGroup}
        onLayoutStructureChange={(next) =>
          ls.applyStructure(next, { preserveRootPlacementIfComplete: true })}
        onEditTile={onEditTile}
        onEditGroup={onEditGroup}
        onPerfTileGridHint={onPerfTileGridHint}
        onItemColSpanChange={onItemColSpanChange}
      />
    </div>
    {#if editLayout}
      <div class="shrink-0 w-full min-w-0">
        <InspectorPanel {layout} />
      </div>
    {/if}
  </div>
{/if}

{#if settingsTile}
  {#key settingsTile.id}
    <TileSettingsOverlay
      tile={settingsTile}
      {plugins}
      parentOptions={parentOptions}
      initialParentId={settingsParentId}
      containerWidthColumns={settingsTileContainerG}
      containerGroups={tileSettingsContainerMeta}
      onClose={overlay.closeTileSettings}
      onSave={overlay.saveTileFromOverlay}
      onDelete={removeTileFromSettings}
    />
  {/key}
{/if}
{#if settingsGroup}
  {#key settingsGroup.id}
    <GroupSettingsOverlay
      group={settingsGroup}
      onClose={overlay.closeGroupSettings}
      onSave={overlay.saveGroupFromOverlay}
      onDelete={removeGroupFromSettings}
    />
  {/key}
{/if}
