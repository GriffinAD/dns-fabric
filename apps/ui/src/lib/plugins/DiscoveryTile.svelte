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
  let recordCount = $state<number | null>(null);
  let busy = $state(false);
  let err = $state<string | null>(null);

  const isCompact = $derived(_tile.displayMode === "compact");

  function formatScanTimestamp(iso: string): string {
    if (!iso || iso === "—") return iso;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  const statusLabel = $derived(
    err
      ? "Scan status unavailable"
      : scanState === "running"
        ? "Network scan active"
        : scanState === "paused"
          ? "Network scan paused"
          : scanState === "failed"
            ? "Network scan failed"
            : scanState === "idle"
              ? "Network scan idle"
              : scanState === "—"
                ? "Loading scan status…"
                : `Scan: ${scanState}`,
  );

  /** Text colour for the status line (compact tail or full-mode badge). */
  const statusTextClass = $derived(
    err || scanState === "failed"
      ? "text-red-600 dark:text-red-400"
      : scanState === "running"
        ? "text-green-600 dark:text-green-400"
        : scanState === "paused"
          ? "text-amber-600 dark:text-amber-400"
          : "text-gray-700 dark:text-gray-300",
  );

  const statusBadgeClass = $derived(
    err || scanState === "failed"
      ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40"
      : scanState === "running"
        ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/40"
        : scanState === "paused"
          ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40"
          : "border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800",
  );

  const pauseBtnClass =
    "inline-flex shrink-0 items-center justify-center rounded-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";

  async function refresh() {
    err = null;
    try {
      const scan = await gateway.getDiscoveryScan();
      scanState = scan.state;
      lastUpdate = scan.updated_at;
      let count: number | null = null;
      if (_tile.displayMode === "compact") {
        count = scan.record_count ?? null;
        if (count == null) {
          try {
            count = (await gateway.listDiscoveryRecords()).items.length;
          } catch {
            count = null;
          }
        }
      }
      recordCount = count;
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

<Card
  size="xl"
  class="box-border !max-w-full w-full min-w-0 flex-1 min-h-0 flex-col border-0 shadow-md"
>
  {#snippet children()}
    <div class="flex flex-col" data-testid="discovery-toolbar">
      {#if isCompact}
        <div class="flex flex-wrap items-center gap-2 py-1">
          <button
            type="button"
            class="{pauseBtnClass} h-7 w-7"
            aria-label={scanState === "paused" ? "Resume scan" : "Pause scan"}
            data-testid="discovery-pause"
            disabled={busy}
            onclick={() => void togglePause()}
          >
            {#if scanState === "paused"}
              <Play class="h-4 w-4" aria-hidden="true" />
            {:else}
              <Pause class="h-4 w-4" aria-hidden="true" />
            {/if}
          </button>
          <p class="text-xs text-gray-600 dark:text-gray-400" data-testid="discovery-compact-summary">
            {#if recordCount != null}
              <span class="font-medium text-gray-700 dark:text-gray-200">{recordCount}</span>
              <span class="text-gray-700 dark:text-gray-200">{recordCount === 1 ? " record" : " records"}</span>
              <span class="text-gray-500 dark:text-gray-500"> · </span>
            {/if}
            <span class={statusTextClass}>{statusLabel}</span>
          </p>
          {#if onOpenSettings}
            <Button class="ml-auto" color="alternative" size="xs" onclick={() => onOpenSettings()}>
              <Settings class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </Button>
          {/if}
        </div>
      {:else}
        <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Last update: {formatScanTimestamp(lastUpdate)}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="{pauseBtnClass} h-9 w-9"
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
            class="rounded-sm border px-2.5 py-1 text-xs font-medium {statusBadgeClass} {statusTextClass}"
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
      {/if}
      {#if err}
        <p class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {/if}
    </div>
  {/snippet}
</Card>
