<script lang="ts">
  import { get } from "svelte/store";
  import { onMount, setContext } from "svelte";

  import AdminPage from "./lib/admin/AdminPage.svelte";
  import type { PluginEntry } from "./lib/api/types";
  import { createAppDashboardShell } from "./lib/appDashboardShell";
  import { attachOperatorShellLifecycle } from "./lib/appMount";
  import { DataGateway } from "./lib/dataGateway";
  import DashboardPage from "./lib/dashboard/DashboardPage.svelte";
  import { createFabricEventBus, FABRIC_EVENT_BUS } from "./lib/dashboard/eventBus";
  import { handlePerfTileGridHint as applyPerfTileGridHint } from "./lib/dashboard/gridHints";
  import ShellHeader from "./lib/dashboard/ShellHeader.svelte";
  import type { DashboardGroup, DashboardTile } from "./lib/dashboard/types";

  let plugins = $state<PluginEntry[]>([]);
  let settingsTile = $state<DashboardTile | null>(null);
  let settingsGroup = $state<DashboardGroup | null>(null);
  let route = $state<"home" | "admin">("home");

  const gateway = new DataGateway();
  const fabricEventBus = createFabricEventBus(gateway);
  setContext(FABRIC_EVENT_BUS, fabricEventBus);
  const { ls, overlay } = createAppDashboardShell(gateway, {
    getTile: () => settingsTile,
    setTile: (t) => {
      settingsTile = t;
    },
    getGroup: () => settingsGroup,
    setGroup: (g) => {
      settingsGroup = g;
    },
  });
  const {
    layout,
    loadError,
    persistError,
    editorOpen,
    layoutSource,
    localPersistBlocked,
    localPersistBlockedReason,
  } = ls;

  async function syncRouteFromHash() {
    const next = window.location.hash === "#/admin" ? "admin" : "home";
    if (route === "home" && next === "admin") await ls.flush();
    route = next;
  }

  function goHome() {
    window.location.hash = "";
    route = "home";
  }

  async function goAdmin() {
    overlay.selectDashboardView();
    await ls.closeEditorAndFlush();
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
    return attachOperatorShellLifecycle({
      syncRouteFromHash,
      gateway,
      fabricEventBus,
      layoutStore: ls,
      setPlugins: (items) => {
        plugins = items;
      },
    });
  });
</script>

<main class="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
  <div class="mx-auto flex max-w-6xl flex-col gap-6">
    <ShellHeader
      {route}
      layoutSource={$layoutSource}
      editorOpen={$editorOpen}
      onSelectDashboardView={() => void selectDashboardView()}
      onOpenEditor={() => ls.openEditor()}
      onResetBaseline={() => void ls.resetToBaseline()}
      onGoHome={goHome}
      onGoAdmin={() => void goAdmin()}
    />

    {#if route === "admin"}
      <AdminPage {gateway} />
    {:else}
      <DashboardPage
        {gateway}
        {plugins}
        layout={$layout}
        editLayout={$editorOpen}
        loadError={$loadError}
        persistError={$persistError}
        localPersistBlocked={$localPersistBlocked}
        localPersistBlockedReason={$localPersistBlockedReason}
        {settingsTile}
        {settingsGroup}
        {ls}
        {overlay}
        {onPerfTileGridHint}
      />
    {/if}
  </div>
</main>
