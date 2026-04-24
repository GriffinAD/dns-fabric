<script lang="ts">
  import { get } from "svelte/store";
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
  import { handlePerfTileGridHint as applyPerfTileGridHint } from "./lib/dashboard/gridHints";
  import { groupOuterColSpan } from "./lib/dashboard/gridPlacement";
  import { createLayoutStore } from "./lib/dashboard/layoutStore";
  import { createOverlayActions } from "./lib/dashboard/overlayActions";
  import GroupSettingsOverlay from "./lib/dashboard/GroupSettingsOverlay.svelte";
  import TileSettingsOverlay from "./lib/dashboard/TileSettingsOverlay.svelte";
  import type { DashboardGroup, DashboardTile } from "./lib/dashboard/types";
  import { findTileInLayout, PARENT_ID_DASHBOARD } from "./lib/dashboard/layoutTree";
  import { UI_VERSION } from "./lib/uiVersion";
  import DashboardControls from "./lib/dashboard/DashboardControls.svelte";
  import ThemeControls from "./lib/theme/ThemeControls.svelte";
  import { loadThemePreferences, resyncDocumentThemeFromStorage } from "./lib/theme/themeStorage";

  let plugins = $state<PluginEntry[]>([]);
  let settingsTile = $state<DashboardTile | null>(null);
  let settingsGroup = $state<DashboardGroup | null>(null);
  let liveCpuPercent = $state<number | null>(null);
  let route = $state<"home" | "admin">("home");

  const gateway = new DataGateway();
  const ls = createLayoutStore({ gateway });
  const { layout, loadError, persistError, editorOpen, layoutSource } = ls;

  const overlay = createOverlayActions({
    getLayout: () => get(layout),
    getEditorOpen: () => get(editorOpen),
    getSettingsTile: () => settingsTile,
    getSettingsGroup: () => settingsGroup,
    setSettingsTile: (t) => {
      settingsTile = t;
    },
    setSettingsGroup: (g) => {
      settingsGroup = g;
    },
    applyLayoutStructure: ls.applyStructure,
  });

  const settingsParentId = $derived.by(() => {
    if (!settingsTile) return PARENT_ID_DASHBOARD;
    const f = findTileInLayout($layout.items, settingsTile.id);
    return f?.inGroup ? f.inGroup.id : PARENT_ID_DASHBOARD;
  });

  const settingsTileContainerG = $derived.by(() => {
    if (!settingsTile) return null;
    const f = findTileInLayout($layout.items, settingsTile.id);
    return f?.inGroup != null ? groupOuterColSpan(f.inGroup) : null;
  });

  const parentOptions = $derived([
    { value: PARENT_ID_DASHBOARD, label: "Dashboard (root)" },
    ...$layout.items
      .filter((it): it is DashboardGroup => it.kind === "group")
      .map((g) => ({ value: g.id, label: `Container: ${g.id}` })),
  ]);

  const tileSettingsContainerMeta = $derived(
    $layout.items
      .filter((it): it is DashboardGroup => it.kind === "group")
      .map((g) => ({ id: g.id, innerWrap: g.innerWrap === true })),
  );

  async function syncRouteFromHash() {
    const next = window.location.hash === "#/admin" ? "admin" : "home";
    if (route === "home" && next === "admin") {
      await ls.flush();
    }
    route = next;
  }

  function goHome() {
    window.location.hash = "";
    route = "home";
  }

  async function goAdmin() {
    await selectDashboardView();
    window.location.hash = "#/admin";
    route = "admin";
  }

  async function selectDashboardView() {
    overlay.selectDashboardView();
    await ls.closeEditorAndFlush();
  }

  function onPerfTileGridHint(tileId: string, hint: { colSpan: number; rowSpan: number }) {
    applyPerfTileGridHint(get(layout).items, tileId, hint, ls.applyStructure);
  }

  onMount(() => {
    void syncRouteFromHash();
    const onHashChange = () => {
      void syncRouteFromHash();
    };
    window.addEventListener("hashchange", onHashChange);

    const onBeforeUnload = () => {
      void ls.flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

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
        ls.loadError.set(message);
      },
      onServerLayoutApplied: (nextLayout) => {
        ls.acceptServerLayout(nextLayout);
      },
      onLayoutHydrationFromServerFailed: () => {
        ls.markLayoutHydratedFromCacheOnly();
      },
      onLiveCpuPercent: (v) => {
        liveCpuPercent = v;
      },
    });

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      mq.removeEventListener("change", onColorScheme);
      stopData();
    };
  });
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
        {#if $layoutSource === "cache"}
          <p
            class="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400"
            data-testid="layout-source-cache-badge"
          >
            Layout loaded from cache (server layout unavailable).
          </p>
        {/if}
      </div>
      <div
        class="flex w-full min-w-0 flex-col items-stretch gap-3 sm:max-w-none sm:flex-1 sm:items-end"
        data-testid="app-header-actions"
      >
        <div class="flex w-full flex-wrap items-end justify-end gap-3">
          <ThemeControls showAccent={route === "home" && $editorOpen} />
          {#if route === "home" && $editorOpen}
            <DashboardControls />
          {/if}
          {#if route === "home"}
            <div role="toolbar" aria-label="Dashboard mode" class="flex flex-wrap items-center gap-1">
              {#if $editorOpen}
                <Button
                  type="button"
                  color="alternative"
                  class="!p-2"
                  aria-label="Return to dashboard"
                  onclick={() => void selectDashboardView()}
                >
                  <ArrowLeft class="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  color="danger"
                  class="outline shrink-0"
                  aria-label="Reset dashboard layout to saved baseline"
                  onclick={() => void ls.resetToBaseline()}
                >
                  Reset
                </Button>
              {:else}
                <Button
                  type="button"
                  color="alternative"
                  class="!p-2"
                  aria-label="Edit layout"
                  onclick={() => ls.openEditor()}
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
          {:else if !$editorOpen}
            <Button type="button" class="inline-flex shrink-0 items-center gap-2" onclick={() => void goAdmin()}>
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
      {#if $loadError}
        <p class="text-red-600 dark:text-red-400" role="alert">{$loadError}</p>
      {:else}
        {#if $persistError}
          <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200" role="status">
            Could not save layout to the server: {$persistError}
          </p>
        {/if}
        <DashboardHost
          layout={$layout}
          {gateway}
          {liveCpuPercent}
          {plugins}
          editLayout={$editorOpen}
          onAddTile={ls.addRootTile}
          onAddGroup={ls.addGroup}
          onAddTileToGroup={ls.addTileToGroup}
          onLayoutStructureChange={ls.applyStructure}
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
