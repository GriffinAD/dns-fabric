<script lang="ts">
  import { onMount } from "svelte";

  import type { DashboardResponse } from "./dashboardZod";
  import { PiholeCpGateway, type PiholeCpMeta } from "./PiholeCpGateway";
  import LogStreamPanel from "./LogStreamPanel.svelte";
  import PiholeLayoutGrid from "./PiholeLayoutGrid.svelte";

  let error = $state<string | null>(null);
  let dashboard = $state<DashboardResponse | null>(null);
  let meta = $state<PiholeCpMeta | null>(null);

  const baseUrl =
    typeof import.meta.env.VITE_PIHOLE_CP_BASE_URL === "string"
      ? import.meta.env.VITE_PIHOLE_CP_BASE_URL
      : "";

  async function loadAll() {
    error = null;
    const gw = new PiholeCpGateway(baseUrl);
    try {
      const [dash, m] = await Promise.all([gw.getDashboard(), gw.getMeta()]);
      dashboard = dash;
      meta = m;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(() => {
    void loadAll();
  });
</script>

<header
  class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
>
  <div class="min-w-0">
    <h1 class="text-lg font-semibold text-slate-900 dark:text-gray-100">Pi-hole HA control plane</h1>
    {#if dashboard}
      <p class="truncate text-sm text-slate-600 dark:text-gray-400">
        Node <span class="font-mono">{meta?.node ?? dashboard.node}</span>
        · v<span class="font-mono">{dashboard.version}</span>
      </p>
    {:else if !error}
      <p class="text-sm text-slate-600 dark:text-gray-400">Loading…</p>
    {/if}
  </div>
  <div class="flex flex-wrap items-center gap-2">
    {#if meta?.peer_ui_base_url}
      <a
        class="text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        href={meta.peer_ui_base_url}
        target="_blank"
        rel="noreferrer"
      >
        Peer UI
      </a>
    {/if}
    <button
      type="button"
      class="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:text-gray-100"
      onclick={() => void loadAll()}
    >
      Refresh
    </button>
  </div>
</header>

{#if error}
  <p class="p-4 text-red-600">{error}</p>
{:else if !dashboard}
  <p class="p-4 text-slate-600 dark:text-gray-400">Loading…</p>
{:else}
  <PiholeLayoutGrid {dashboard} />
  <LogStreamPanel {baseUrl} />
{/if}
