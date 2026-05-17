<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import Card from "flowbite-svelte/Card.svelte";
import Spinner from "flowbite-svelte/Spinner.svelte";
  import Pause from "lucide-svelte/icons/pause";
  import Play from "lucide-svelte/icons/play";
  import Settings from "lucide-svelte/icons/settings";
  import { onMount } from "svelte";

  import { DataGateway } from "../../dataGateway";
  import type { DashboardTile } from "../../dashboard/types";

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
  let showTempSettingsModal = $state(false);

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
    "inline-flex shrink-0 items-center justify-center rounded-md border border-gray-400 bg-gray-300 text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";

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

  function openSettings() {
    if (onOpenSettings) {
      onOpenSettings();
      return;
    }
    showTempSettingsModal = true;
  }

  function closeTempSettingsModal() {
    showTempSettingsModal = false;
  }

  onMount(() => {
    void refresh();
  });
</script>

<Card
  size="xl"
  class="box-border !max-w-full w-full min-w-0 flex-1 min-h-0 flex-col shadow-md"
>
  {#snippet children()}
    <div class="flex h-full min-h-0 flex-col" data-testid="discovery-toolbar">
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
          <Button
            class="ml-auto"
            color="alternative"
            size="xs"
            aria-label="Discovery settings"
            onclick={openSettings}
          >
            <Settings class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Button>
        </div>
      {:else}
        <div class="flex flex-1 flex-col justify-center px-4">
          <div class="flex flex-wrap items-center gap-3 py-1">
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
            {#if scanState === "running" && !err}
              <Spinner type="pulse" color="blue" />
            {/if}
            <Button
              class="!h-9 !rounded-md ml-auto"
              color="alternative"
              size="sm"
              aria-label="Discovery settings"
              onclick={openSettings}
            >
              <Settings class="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
              Settings
            </Button>
          </div>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Last updated: {formatScanTimestamp(lastUpdate)}
          </p>
        </div>
      {/if}
      {#if err}
        <p class="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {/if}
    </div>

    {#if showTempSettingsModal}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="presentation"
        onclick={(e) => {
          if (e.target === e.currentTarget) closeTempSettingsModal();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discovery-settings-temp-title"
          tabindex="-1"
          class="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800"
          onclick={(e) => e.stopPropagation()}
        >
          <h3 id="discovery-settings-temp-title" class="text-base font-semibold text-gray-900 dark:text-white">
            Discovery settings
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Temporary settings placeholder. Wire this to the real discovery settings panel.
          </p>
          <div class="mt-4 flex justify-end">
            <Button type="button" color="alternative" size="sm" onclick={closeTempSettingsModal}>Close</Button>
          </div>
        </div>
      </div>
    {/if}
  {/snippet}
</Card>
