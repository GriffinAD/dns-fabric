<script lang="ts">
  import { onMount } from "svelte";

  import { PiholeCpGateway } from "./PiholeCpGateway";
  import type { LogsCatalogResponse } from "./dashboardZod";

  let { baseUrl }: { baseUrl: string } = $props();

  let catalog = $state<LogsCatalogResponse | null>(null);
  let catalogError = $state<string | null>(null);
  let selectedId = $state("");
  let lines = $state("");
  let streamError = $state<string | null>(null);
  let source: EventSource | null = null;

  async function loadCatalog() {
    catalogError = null;
    try {
      const gw = new PiholeCpGateway(baseUrl);
      catalog = await gw.getLogsCatalog();
      if (catalog.logs.length > 0 && !selectedId) {
        selectedId = catalog.logs[0]!.id;
      }
    } catch (e) {
      catalog = null;
      catalogError = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(() => {
    void loadCatalog();
    return () => {
      source?.close();
      source = null;
    };
  });

  function stopStream() {
    source?.close();
    source = null;
  }

  function startStream() {
    streamError = null;
    stopStream();
    if (!selectedId) {
      streamError = "Select a log stream.";
      return;
    }
    const url = `${baseUrl.replace(/\/$/, "")}/logs/stream/${encodeURIComponent(selectedId)}`;
    const es = new EventSource(url);
    source = es;
    lines = "";
    es.onmessage = (ev) => {
      lines += `${ev.data}\n`;
    };
    es.onerror = () => {
      streamError = "EventSource error (connection lost or refused).";
      stopStream();
    };
  }
</script>

<section class="border-t border-slate-200 p-4 dark:border-gray-700">
  <h2 class="mb-2 text-sm font-semibold text-slate-800 dark:text-gray-100">Log streams</h2>
  {#if catalogError}
    <p class="text-sm text-red-600">{catalogError}</p>
  {:else if !catalog}
    <p class="text-sm text-slate-600 dark:text-gray-400">Loading catalogue…</p>
  {:else}
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <label class="text-xs text-slate-600 dark:text-gray-400" for="pihole-cp-log-select">Stream</label>
      <select
        id="pihole-cp-log-select"
        class="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
        bind:value={selectedId}
      >
        {#each catalog.logs as L (L.id)}
          <option value={L.id}>{L.label}</option>
        {/each}
      </select>
      <button
        type="button"
        class="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
        onclick={startStream}
      >
        Start
      </button>
      <button
        type="button"
        class="rounded border border-slate-300 px-3 py-1 text-sm dark:border-gray-600"
        onclick={stopStream}
      >
        Stop
      </button>
    </div>
    {#if streamError}
      <p class="mb-2 text-sm text-red-600">{streamError}</p>
    {/if}
    <pre class="max-h-64 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-950">{lines}</pre>
  {/if}
</section>
