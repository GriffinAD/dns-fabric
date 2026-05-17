<script lang="ts">
  import { get } from "svelte/store";
  import { onMount, setContext } from "svelte";

  import AdminPage from "./lib/admin/AdminPage.svelte";
  import type { PluginEntry } from "./lib/api/types";
  import { createAppDashboardShell } from "./lib/appDashboardShell";
  import { attachOperatorShellLifecycle } from "./lib/appMount";
  import { DataGateway } from "./lib/dataGateway";
  import DashboardPage from "./lib/dashboard/DashboardPage.svelte";
  import { attachFabricBusKernel } from "./lib/dashboard/fabricBusKernel";
  import { FABRIC_EVENT_BUS } from "./lib/dashboard/eventBus";
  import { handlePerfTileGridHint as applyPerfTileGridHint } from "./lib/dashboard/gridHints";
  import ShellHeader from "./lib/dashboard/ShellHeader.svelte";
  import type { DashboardGroup, DashboardTile } from "./lib/dashboard/types";

  let plugins = $state<PluginEntry[]>([]);
  let settingsTile = $state<DashboardTile | null>(null);
  let settingsGroup = $state<DashboardGroup | null>(null);
  let route = $state<"home" | "admin">("home");
  /** Sub-path under admin, e.g. `ui/gauges` for `#/admin/ui/gauges`. */
  let adminSubpath = $state("");

  const gateway = new DataGateway();
  const fabricBusKernel = attachFabricBusKernel({ gateway });
  setContext(FABRIC_EVENT_BUS, fabricBusKernel.bus);
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

  function adminTailFromHash(hash: string): string {
    if (!hash.startsWith("#/admin")) return "";
    const tail = hash.slice("#/admin".length);
    if (tail === "" || tail === "/") return "";
    return tail.replace(/^\//, "");
  }

  async function syncRouteFromHash() {
    const h = window.location.hash;
    const isAdmin = h === "#/admin" || h.startsWith("#/admin/");
    if (route === "home" && isAdmin) await ls.flush();
    route = isAdmin ? "admin" : "home";
    adminSubpath = isAdmin ? adminTailFromHash(h) : "";
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
      fabricBusKernel,
      layoutStore: ls,
      setPlugins: (items) => {
        plugins = items;
      },
    });
  });
</script>

<main class="min-h-screen bg-slate-100 p-8 dark:bg-gray-900">
  <div class="mx-auto w-full max-w-6xl">
    <ShellHeader
      {route}
      layout={$layout}
      layoutSource={$layoutSource}
      editorOpen={$editorOpen}
      onSelectDashboardView={() => void selectDashboardView()}
      onOpenEditor={() => ls.openEditor()}
      onResetBaseline={() => void ls.resetToBaseline()}
      onSaveLayoutToFile={() => void ls.saveLayoutToFile()}
      onImportLayout={(next) => ls.importLayout(next)}
      onImportError={(message) => ls.loadError.set(message)}
      onGoHome={goHome}
      onGoAdmin={() => void goAdmin()}
    />
  </div>

  <div
    class="mx-auto mt-6 flex flex-col gap-6"
    class:max-w-6xl={route !== "admin"}
    class:max-w-[140rem]={route === "admin"}
  >

    {#if route === "admin"}
      <AdminPage {gateway} adminSubpath={adminSubpath} />
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
