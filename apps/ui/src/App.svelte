<script lang="ts">
  import { onMount } from "svelte";
  import Button from "flowbite-svelte/Button.svelte";
  import House from "lucide-svelte/icons/house";

  import type { PluginEntry } from "./lib/api/types";
  import { DataGateway } from "./lib/dataGateway";
  import DashboardEditor from "./lib/dashboard/DashboardEditor.svelte";
  import DashboardHost from "./lib/dashboard/DashboardHost.svelte";
  import { DEFAULT_DASHBOARD_LAYOUT } from "./lib/dashboard/defaultLayout";
  import type { DashboardLayout } from "./lib/dashboard/types";
  import { UI_VERSION } from "./lib/uiVersion";

  let plugins = $state<PluginEntry[]>([]);
  let layout = $state<DashboardLayout>(structuredClone(DEFAULT_DASHBOARD_LAYOUT));
  let editorOpen = $state(false);
  let loadError = $state<string | null>(null);

  const gateway = new DataGateway();

  onMount(() => {
    void gateway
      .listPlugins()
      .then((r) => {
        plugins = r.items;
      })
      .catch((e: unknown) => {
        loadError = e instanceof Error ? e.message : String(e);
      });
  });

  function addTile(pluginId: string) {
    const id = `tile-${layout.tiles.length + 1}-${Date.now()}`;
    layout = {
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
  }
</script>

<main class="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
  <div class="mx-auto flex max-w-4xl flex-col gap-6">
    <header class="flex flex-col gap-2">
      <h1 class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
        <House class="h-8 w-8 shrink-0" aria-hidden="true" />
        Kea Fabric
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Operator shell ({UI_VERSION}). Flowbite Svelte v2 + mocked <code class="font-mono text-sm">/api/v1</code>.
      </p>
    </header>

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
      <DashboardEditor {plugins} {layout} onAddTile={addTile} />
    {:else}
      <DashboardHost {layout} />
    {/if}
  </div>
</main>
