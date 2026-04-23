<script lang="ts">
  import { onMount } from "svelte";
  import Button from "flowbite-svelte/Button.svelte";
  import ArrowLeft from "lucide-svelte/icons/arrow-left";
  import House from "lucide-svelte/icons/house";
  import Pencil from "lucide-svelte/icons/pencil";
  import Settings from "lucide-svelte/icons/settings";

  import AdminPage from "./lib/admin/AdminPage.svelte";
  import type { PluginEntry } from "./lib/api/types";
  import { DataGateway } from "./lib/dataGateway";
  import DashboardHost from "./lib/dashboard/DashboardHost.svelte";
  import { mountDashboardGatewaySideEffects } from "./lib/dashboard/dashboardBootstrap";
  import { handlePerfTileGridHint } from "./lib/dashboard/gridHints";
  import { groupOuterColSpan } from "./lib/dashboard/gridPlacement";
  import {
    initialDashboardLayout,
    parseDashboardLayout,
    saveDashboardLayout,
  } from "./lib/dashboard/layoutStorage";
  import { normalizeLayoutStrict } from "./lib/dashboard/layoutNormalize";
  import { findTileInLayout, PARENT_ID_DASHBOARD } from "./lib/dashboard/layoutTree";
  import { createOverlayActions } from "./lib/dashboard/overlayActions";
  import GroupSettingsOverlay from "./lib/dashboard/GroupSettingsOverlay.svelte";
  import TileSettingsOverlay from "./lib/dashboard/TileSettingsOverlay.svelte";
  import type { DashboardGroup, DashboardLayout, DashboardLayoutV2, DashboardTile, RootLayoutItem } from "./lib/dashboard/types";
  import { isLayoutV2 } from "./lib/dashboard/types";
  import { UI_VERSION } from "./lib/uiVersion";
  import DashboardControls from "./lib/dashboard/DashboardControls.svelte";
  import ThemeControls from "./lib/theme/ThemeControls.svelte";
  import { loadThemePreferences, resyncDocumentThemeFromStorage } from "./lib/theme/themeStorage";

  let plugins = $state<PluginEntry[]>([]);
  let layout = $state<DashboardLayoutV2>(initialDashboardLayout());
  let editorOpen = $state(false);
  let loadError = $state<string | null>(null);
  let liveCpuPercent = $state<number | null>(null);
  let route = $state<"home" | "admin">("home");
  let settingsTile = $state<DashboardTile | null>(null);
  let settingsGroup = $state<DashboardGroup | null>(null);

  const gateway = new DataGateway();

  function applyLayoutStructure(
    next: DashboardLayout,
    opts?: { preserveRootPlacementIfComplete?: boolean; editModeOverride?: boolean },
  ) {
    try {
      const editMode = opts?.editModeOverride !== undefined ? opts.editModeOverride : editorOpen;
      const normalized = normalizeLayoutStrict(next, editMode, {
        preserveRootPlacementIfComplete: opts?.preserveRootPlacementIfComplete,
      });
      loadError = null;
      layout = normalized;
      saveDashboardLayout(normalized);
      void gateway.putDashboardLayout("default", normalized).catch(() => {});
    } catch (e: unknown) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  const overlay = createOverlayActions({
    getLayout: () => layout,
    getEditorOpen: () => editorOpen,
    getSettingsTile: () => settingsTile,
    getSettingsGroup: () => settingsGroup,
    setSettingsTile: (t) => {
      settingsTile = t;
    },
    setSettingsGroup: (g) => {
      settingsGroup = g;
    },
    applyLayoutStructure,
  });

  function syncRouteFromHash() {
    route = window.location.hash === "#/admin" ? "admin" : "home";
  }

  function goHome() {
    window.location.hash = "";
    route = "home";
  }

  function goAdmin() {
    selectDashboardView();
    window.location.hash = "#/admin";
    route = "admin";
  }

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

  function selectDashboardView() {
    overlay.selectDashboardView();
    editorOpen = false;
  }

  onMount(() => {
    syncRouteFromHash();
    window.addEventListener("hashchange", syncRouteFromHash);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onColorScheme = () => {
      if (loadThemePreferences().mode === "system") {
        resyncDocumentThemeFromStorage();
      }
    };
    mq.addEventListener("change", onColorScheme);

    const stopData = mountDashboardGatewaySideEffects(gateway, {
      onPluginsLoaded: (items) => {
        plugins = items;
      },
      onPluginListError: (message) => {
        loadError = message;
      },
      onServerLayoutApplied: (nextLayout) => {
        layout = nextLayout;
      },
      onLiveCpuPercent: (v) => {
        liveCpuPercent = v;
      },
    });

    return () => {
      window.removeEventListener("hashchange", syncRouteFromHash);
      mq.removeEventListener("change", onColorScheme);
      stopData();
    };
  });

  function addTile(pluginId: string) {
    const n = layout.items.length;
    const id = `tile-${n + 1}-${Date.now()}`;
    const next: RootLayoutItem = {
      kind: "tile",
      id,
      pluginId,
      hostControl: "single-panel",
      displayMode: "full",
    };
    applyLayoutStructure({ version: 2, items: [...layout.items, next] });
  }

  function addGroup() {
    const n = layout.items.length;
    const id = `group-${n + 1}-${Date.now()}`;
    const next: DashboardGroup = { kind: "group", id, showBorder: true, children: [] };
    applyLayoutStructure({ version: 2, items: [...layout.items, next] });
  }

  function addTileToGroup(groupId: string, pluginId: string) {
    const tId = `tile-in-${groupId}-${Date.now()}`;
    const newTile: DashboardTile = {
      id: tId,
      pluginId,
      hostControl: "single-panel",
      displayMode: "full",
    };
    const items = layout.items.map((it) => {
      if (it.kind === "group" && it.id === groupId) {
        return { ...it, children: [...it.children, newTile] } satisfies DashboardGroup;
      }
      return it;
    });
    applyLayoutStructure({ version: 2, items });
  }

  async function resetLayoutToBaseline() {
    loadError = null;
    try {
      const raw = await gateway.resetDashboardLayout("default");
      const parsed = parseDashboardLayout(raw);
      if (!parsed) {
        loadError = "Reset returned an invalid layout.";
        return;
      }
      applyLayoutStructure(parsed);
    } catch (e: unknown) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  function onPerfTileGridHint(tileId: string, hint: { colSpan: number; rowSpan: number }) {
    handlePerfTileGridHint(layout.items, tileId, hint, applyLayoutStructure);
  }
</script>

<main class="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
  <div class="mx-auto flex max-w-6xl flex-col gap-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
          <House class="h-8 w-8 shrink-0" aria-hidden="true" />
          Kea Fabric
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Operator shell ({UI_VERSION}). Flowbite Svelte v2 + mocked <code class="font-mono text-sm">/api/v1</code>.
        </p>
      </div>
      <div
        class="flex w-full min-w-0 flex-col items-stretch gap-3 sm:max-w-none sm:flex-1 sm:items-end"
        data-testid="app-header-actions"
      >
        <div class="flex w-full flex-wrap items-end justify-end gap-3">
          <ThemeControls showAccent={route === "home" && editorOpen} />
          {#if route === "home" && editorOpen}
            <DashboardControls />
          {/if}
          {#if route === "home"}
            <div role="toolbar" aria-label="Dashboard mode" class="flex flex-wrap items-center gap-1">
              {#if editorOpen}
                <Button
                  type="button"
                  color="alternative"
                  class="!p-2"
                  aria-label="Return to dashboard"
                  onclick={selectDashboardView}
                >
                  <ArrowLeft class="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  color="danger"
                  class="outline shrink-0"
                  aria-label="Reset dashboard layout to saved baseline"
                  onclick={resetLayoutToBaseline}
                >
                  Reset
                </Button>
              {:else}
                <Button
                  type="button"
                  color="alternative"
                  class="!p-2"
                  aria-label="Edit layout"
                  onclick={() => (editorOpen = true)}
                >
                  <Pencil class="h-5 w-5" aria-hidden="true" />
                </Button>
              {/if}
            </div>
          {/if}
          {#if route === "admin"}
            <Button
              type="button"
              color="alternative"
              class="inline-flex shrink-0 items-center gap-2"
              onclick={goHome}
            >
              <House class="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Button>
          {:else if !editorOpen}
            <Button type="button" class="inline-flex shrink-0 items-center gap-2" onclick={goAdmin}>
              <Settings class="h-4 w-4" aria-hidden="true" />
              Admin
            </Button>
          {/if}
        </div>
      </div>
    </header>

    {#if route === "admin"}
      <AdminPage {gateway} />
    {:else}
      {#if loadError}
        <p class="text-red-600 dark:text-red-400" role="alert">{loadError}</p>
      {:else}
        <DashboardHost
          {layout}
          {gateway}
          {liveCpuPercent}
          {plugins}
          editLayout={editorOpen}
          onAddTile={addTile}
          onAddGroup={addGroup}
          onAddTileToGroup={addTileToGroup}
          onLayoutStructureChange={applyLayoutStructure}
          onEditTile={overlay.openTileSettings}
          onEditGroup={overlay.openGroupSettings}
          onDeleteRootItem={overlay.deleteRootLayoutItem}
          onDeleteGroupChildTile={overlay.deleteGroupChildTile}
          onPerfTileGridHint={onPerfTileGridHint}
        />
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
    {/if}
  </div>
</main>
