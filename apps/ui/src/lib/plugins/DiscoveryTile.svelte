<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import Card from "flowbite-svelte/Card.svelte";
  import Pause from "lucide-svelte/icons/pause";
  import Play from "lucide-svelte/icons/play";
  import Settings from "lucide-svelte/icons/settings";
  import { onMount } from "svelte";

  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let {
    gateway,
    tile: _tile,
    onOpenSettings,
  }: { gateway: DataGateway; tile: DashboardTile; onOpenSettings?: () => void } = $props();

  let scanState = $state<string>("—");
  let lastUpdate = $state<string>("—");
  let busy = $state(false);
  let err = $state<string | null>(null);

  function formatScanTimestamp(iso: string): string {
    if (!iso || iso === "—") return iso;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  const statusLabel = $derived(
    scanState === "running"
      ? "Network scan active"
      : scanState === "paused"
        ? "Network scan paused"
        : `Scan: ${scanState}`,
  );

  async function refresh() {
    err = null;
    try {
      const scan = await gateway.getDiscoveryScan();
      scanState = scan.state;
      lastUpdate = scan.updated_at;
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function togglePause() {
    busy = true;
    err = null;
    try {
      const scan = await gateway.getDiscoveryScan();
      const nextPaused = scan.state !== "paused";
      const updated = await gateway.pauseDiscoveryScan(nextPaused);
      scanState = updated.state;
      lastUpdate = updated.updated_at;
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    void refresh();
  });
</script>

<Card size="xl" class="h-full border-0 shadow-md">
  {#snippet children()}
    <div class="flex flex-col" data-testid="discovery-toolbar">
      <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Last update: {formatScanTimestamp(lastUpdate)}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          aria-label={scanState === "paused" ? "Resume scan" : "Pause scan"}
          data-testid="discovery-pause"
          disabled={busy}
          onclick={() => void togglePause()}
        >
          {#if scanState === "paused"}
            <Play class="h-5 w-5" aria-hidden="true" />
          {:else}
            <Pause class="h-5 w-5" aria-hidden="true" />
          {/if}
        </button>
        <span
          class="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          role="status"
        >
          {statusLabel}
        </span>
        {#if onOpenSettings}
          <Button class="ml-auto" color="alternative" size="sm" onclick={() => onOpenSettings()}>
            <Settings class="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            Settings
          </Button>
        {/if}
      </div>
      {#if err}
        <p class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {/if}
    </div>
  {/snippet}
</Card>
