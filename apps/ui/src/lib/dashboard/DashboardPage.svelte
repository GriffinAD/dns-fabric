<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";

  import type { PluginEntry } from "../api/types";
  import type { DataGateway } from "../dataGateway";
  import DashboardToolbar from "./editor/DashboardToolbar.svelte";
  import InspectorPanel from "./editor/InspectorPanel.svelte";
  import { editorSelection } from "./editor/editorState";
  import DashboardHost from "./DashboardHost.svelte";
  import GroupSettingsOverlay from "./GroupSettingsOverlay.svelte";
  import TileSettingsOverlay from "./TileSettingsOverlay.svelte";
  import { groupOuterColSpan } from "./gridPlacement";
  import type { LayoutStore } from "./layoutStore";
  import { findTileInLayout, PARENT_ID_DASHBOARD } from "./layoutTree";
  import { clearStoredDashboardLayoutAndUnlock } from "./layoutStorage";
  import type { OverlayActions } from "./overlayActions";
  import type { DashboardGroup, DashboardLayoutV2, DashboardTile } from "./types";

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
  }: {
    gateway: DataGateway;
    plugins: PluginEntry[];
    layout: DashboardLayoutV2;
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
    ...layout.items
      .filter((it): it is DashboardGroup => it.kind === "group")
      .map((g) => ({ value: g.id, label: `Container: ${g.id}` })),
  ]);

  const tileSettingsContainerMeta = $derived(
    layout.items
      .filter((it): it is DashboardGroup => it.kind === "group")
      .map((g) => ({ id: g.id, innerWrap: g.innerWrap === true })),
  );

  function onEditTile(tile: DashboardTile) {
    editorSelection.set({ kind: "tile", id: tile.id, label: tile.pluginId });
    overlay.openTileSettings(tile);
  }

  function onEditGroup(g: DashboardGroup) {
    editorSelection.set({ kind: "group", id: g.id, label: g.id });
    overlay.openGroupSettings(g);
  }
</script>

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
  <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
    <div class="shrink-0 lg:w-52">
      <DashboardToolbar {ls} {editLayout} />
    </div>
    <div class="min-w-0 flex-1">
      <DashboardHost
        {layout}
        {gateway}
        {plugins}
        {editLayout}
        onAddTile={ls.addRootTile}
        onAddGroup={ls.addGroup}
        onAddTileToGroup={ls.addTileToGroup}
        onLayoutStructureChange={(next) =>
          ls.applyStructure(next, { preserveRootPlacementIfComplete: true })}
        onEditTile={onEditTile}
        onEditGroup={onEditGroup}
        onDeleteRootItem={overlay.deleteRootLayoutItem}
        onDeleteGroupChildTile={overlay.deleteGroupChildTile}
        onPerfTileGridHint={onPerfTileGridHint}
      />
    </div>
    <div class="shrink-0 lg:w-64">
      <InspectorPanel {layout} />
    </div>
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
    />
  {/key}
{/if}
{#if settingsGroup}
  {#key settingsGroup.id}
    <GroupSettingsOverlay group={settingsGroup} onClose={overlay.closeGroupSettings} onSave={overlay.saveGroupFromOverlay} />
  {/key}
{/if}
