<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import { onMount } from "svelte";

  import type { HealthResponse } from "../api/types";
  import SemicircleGauge from "../components/SemicircleGauge.svelte";
  import { DataGateway } from "../dataGateway";

  let { gateway }: { gateway: DataGateway } = $props();

  let health = $state<HealthResponse | null>(null);
  let err = $state<string | null>(null);

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

<div class="mx-auto flex max-w-4xl flex-col gap-6" data-testid="admin-page">
  <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Administration</h2>
  <p class="text-sm text-gray-600 dark:text-gray-400">
    Sectioned operator settings (mocked API). Discovery, replication, and identity integrations are stubs until backend
    routes exist.
  </p>

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
            SemicircleGauge primitive (health-weighted demo, UI_ENGINE_PLAN P5)
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
</div>
