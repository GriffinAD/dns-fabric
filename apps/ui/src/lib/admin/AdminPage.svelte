<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import { onMount } from "svelte";

  import type { HealthResponse } from "../api/types";
  import SemicircleGauge from "../components/SemicircleGauge.svelte";
  import { DataGateway } from "../dataGateway";
  import GaugeThemeControls from "../theme/GaugeThemeControls.svelte";

  let { gateway, adminSubpath = "" }: { gateway: DataGateway; adminSubpath?: string } = $props();

  const isUiGauges = $derived(adminSubpath === "ui/gauges");

  let health = $state<HealthResponse | null>(null);
  let err = $state<string | null>(null);

  /** Drives the dashed “Live preview” semicircle only (not persisted). */
  let gaugePreviewPercent = $state(100);

  function clampGaugePreviewPercent(n: number): number {
    if (typeof n !== "number" || !Number.isFinite(n)) {
      return 0;
    }
    return Math.max(0, Math.min(100, n));
  }

  onMount(() => {
    void gateway
      .getHealth()
      .then((h) => {
        health = h;
      })
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
      });
  });
</script>

<div
  class="mx-auto flex flex-col gap-6"
  class:max-w-7xl={isUiGauges}
  class:max-w-4xl={!isUiGauges}
  data-testid="admin-page"
>
  <nav
    class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-200 pb-3 text-sm dark:border-gray-700"
    aria-label="Admin sections"
  >
    <a
      href="#/admin"
      class="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 {!isUiGauges
        ? 'font-semibold text-gray-900 dark:text-white'
        : 'text-primary-600 hover:underline dark:text-primary-400'}"
      data-testid="admin-nav-overview"
    >
      Overview
    </a>
    <span class="text-gray-400" aria-hidden="true">/</span>
    <span class="text-gray-500 dark:text-gray-400">UI</span>
    <span class="text-gray-400" aria-hidden="true">/</span>
    <a
      href="#/admin/ui/gauges"
      class="rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 {isUiGauges
        ? 'font-semibold text-gray-900 dark:text-white'
        : 'text-primary-600 hover:underline dark:text-primary-400'}"
      data-testid="admin-nav-ui-gauges"
    >
      Gauges
    </a>
  </nav>

  {#if isUiGauges}
    <div data-testid="admin-ui-gauges-page">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        <span class="text-gray-500 dark:text-gray-500">Administration</span>
        <span class="mx-1.5 text-gray-400" aria-hidden="true">›</span>
        <span>UI</span>
        <span class="mx-1.5 text-gray-400" aria-hidden="true">›</span>
        <span class="font-medium text-gray-900 dark:text-white">Gauges</span>
      </p>
      <h2 class="mt-2 text-xl font-semibold text-gray-900 dark:text-white">Gauge appearance</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Global options for semicircle gauges on the dashboard. Values are saved in the browser with your theme
        preferences.
      </p>

      <Card class="mt-4">
        {#snippet children()}
          <div class="flex w-full min-w-0 flex-col gap-6">
            <div class="w-full min-w-0 max-w-4xl">
              <GaugeThemeControls />
            </div>
            <div
              class="flex min-h-72 w-full min-w-0 max-w-3xl flex-col rounded-lg border border-dashed border-gray-200 p-4 dark:border-gray-600"
              data-testid="admin-gauge-settings-preview"
            >
              <div
                class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
              >
                <p class="text-center text-xs font-medium text-gray-500 sm:text-left dark:text-gray-400">
                  Live preview
                </p>
                <div class="flex min-w-0 flex-col sm:items-end">
                  <label
                    for="admin-gauge-preview-percent"
                    class="mb-0.5 block text-xs text-gray-600 dark:text-gray-400"
                  >
                    Preview value (0–100)
                  </label>
                  <input
                    id="admin-gauge-preview-percent"
                    data-testid="admin-gauge-preview-percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    class="w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 sm:w-28 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    bind:value={gaugePreviewPercent}
                    onchange={() => {
                      gaugePreviewPercent = clampGaugePreviewPercent(gaugePreviewPercent);
                    }}
                    onblur={() => {
                      gaugePreviewPercent = clampGaugePreviewPercent(gaugePreviewPercent);
                    }}
                  />
                </div>
              </div>
              <div
                class="mt-4 flex w-full min-w-0 flex-1 items-center justify-center p-1"
              >
                <div class="flex w-full max-w-none justify-center">
                  <SemicircleGauge label="Preview" percent={gaugePreviewPercent} preview />
                </div>
              </div>
            </div>
          </div>
        {/snippet}
      </Card>
    </div>
  {:else}
    <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Administration</h2>
    <p class="text-sm text-gray-600 dark:text-gray-400">
      Sectioned operator settings (mocked API). Discovery, replication, and identity integrations are stubs until backend
      routes exist.
    </p>

    <Card>
      {#snippet children()}
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">UI</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Global gauge caps, segment lines, and gap width.
        </p>
        <p class="mt-3">
          <a
            href="#/admin/ui/gauges"
            class="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            data-testid="admin-link-ui-gauges"
          >
            Open Gauges settings →
          </a>
        </p>
      {/snippet}
    </Card>

    <Card>
      {#snippet children()}
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">API / health</h3>
        {#if err}
          <p class="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>
        {:else if !health}
          <p class="mt-2 text-sm text-gray-500">Loading…</p>
        {:else}
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-200">Status: <span class="font-mono">{health.status}</span></p>
          <p class="text-xs text-gray-500 dark:text-gray-400">Checked {health.checked_at}</p>
          <div
            class="mt-4 flex max-w-xs flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 p-3 dark:border-gray-600"
            data-testid="admin-gauge-primitive-demo"
          >
            <p class="text-center text-xs text-gray-500 dark:text-gray-400">
              SemicircleGauge primitive (health-weighted demo, `docs/planning/UI_ENGINE_PLAN.md` P5)
            </p>
            <SemicircleGauge
              label="Sample load"
              percent={health.status === "ok" ? 18 : health.status === "degraded" ? 52 : 78}
            />
          </div>
        {/if}
      {/snippet}
    </Card>

    <Card>
      {#snippet children()}
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Discovery</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Policy and scan defaults — wire to admin API in Phase B.</p>
      {/snippet}
    </Card>

    <Card>
      {#snippet children()}
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Dashboard defaults</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Server-side layout templates — use Edit layout on the home dashboard for now.</p>
      {/snippet}
    </Card>

    <Card>
      {#snippet children()}
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Nebula / replication</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Read-only status per ADR-0011 — deferred depth.</p>
      {/snippet}
    </Card>
  {/if}
</div>
