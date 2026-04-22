<script lang="ts">
  import { onMount } from "svelte";
  import Button from "flowbite-svelte/Button.svelte";
  import House from "lucide-svelte/icons/house";
  import Settings from "lucide-svelte/icons/settings";

  import AdminPage from "./lib/admin/AdminPage.svelte";
  import type { PluginEntry } from "./lib/api/types";
  import { DataGateway } from "./lib/dataGateway";
  import DashboardEditor from "./lib/dashboard/DashboardEditor.svelte";
  import DashboardHost from "./lib/dashboard/DashboardHost.svelte";
  import { initialDashboardLayout, saveDashboardLayout } from "./lib/dashboard/layoutStorage";
  import type { DashboardLayout } from "./lib/dashboard/types";
  import { UI_VERSION } from "./lib/uiVersion";

  let plugins = $state<PluginEntry[]>([]);
  let layout = $state<DashboardLayout>(initialDashboardLayout());
  let editorOpen = $state(false);
  let loadError = $state<string | null>(null);
  let liveCpuPercent = $state<number | null>(null);
  let route = $state<"home" | "admin">("home");

  const gateway = new DataGateway();

  function syncRouteFromHash() {
    route = window.location.hash === "#/admin" ? "admin" : "home";
  }

  function goHome() {
    window.location.hash = "";
    route = "home";
  }

  function goAdmin() {
    window.location.hash = "#/admin";
    route = "admin";
  }

  onMount(() => {
    syncRouteFromHash();
    window.addEventListener("hashchange", syncRouteFromHash);

    void gateway
      .listPlugins()
      .then((r) => {
        plugins = r.items;
      })
      .catch((e: unknown) => {
        loadError = e instanceof Error ? e.message : String(e);
      });

    const unsub = gateway.subscribeFabricEvents(
      (ev) => {
        if (ev.topic === "fabric.perf.updated") {
          const v = ev.payload.cpu_percent_total;
          if (typeof v === "number" && Number.isFinite(v)) {
            liveCpuPercent = v;
          }
        }
      },
      () => {},
    );

    return () => {
      window.removeEventListener("hashchange", syncRouteFromHash);
      unsub();
    };
  });

  function addTile(pluginId: string) {
    const id = `tile-${layout.tiles.length + 1}-${Date.now()}`;
    const next: DashboardLayout = {
      ...layout,
      tiles: [
        ...layout.tiles,
        {
          id,
          pluginId,
          hostControl: "single-panel",
          displayMode: "full",
        },
      ],
    };
    applyLayout(next);
  }

  function applyLayout(next: DashboardLayout) {
    layout = next;
    saveDashboardLayout(next);
    void gateway.putDashboardLayout("default", next).catch(() => {});
  }
</script>

<main class="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
  <div class="mx-auto flex max-w-6xl flex-col gap-6">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
          <House class="h-8 w-8 shrink-0" aria-hidden="true" />
          Kea Fabric
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Operator shell ({UI_VERSION}). Flowbite Svelte v2 + mocked <code class="font-mono text-sm">/api/v1</code>.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button type="button" color="alternative" class="inline-flex items-center gap-2" onclick={goHome}>
          <House class="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Button>
        <Button type="button" class="inline-flex items-center gap-2" onclick={goAdmin}>
          <Settings class="h-4 w-4" aria-hidden="true" />
          Admin
        </Button>
      </div>
    </header>

    {#if route === "admin"}
      <AdminPage {gateway} />
    {:else}
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="Dashboard mode">
        <Button type="button" color={editorOpen ? "alternative" : "brand"} onclick={() => (editorOpen = false)}>
          Dashboard
        </Button>
        <Button type="button" color={editorOpen ? "brand" : "alternative"} onclick={() => (editorOpen = true)}>
          Edit layout
        </Button>
      </div>

      {#if loadError}
        <p class="text-red-600 dark:text-red-400" role="alert">{loadError}</p>
      {:else if editorOpen}
        <DashboardEditor {plugins} {layout} onAddTile={addTile} onLayoutChange={applyLayout} />
      {:else}
        <DashboardHost {layout} {gateway} {liveCpuPercent} />
      {/if}
    {/if}
  </div>
</main>
