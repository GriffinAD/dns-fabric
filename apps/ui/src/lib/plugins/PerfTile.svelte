<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import { onMount } from "svelte";

  import type { PerfSummaryResponse } from "../api/types";
  import SemicircleGauge from "../components/SemicircleGauge.svelte";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let {
    gateway,
    tile,
    liveCpuPercent,
  }: { gateway: DataGateway; tile: DashboardTile; liveCpuPercent?: number | null } = $props();

  let summary = $state<PerfSummaryResponse | null>(null);
  let err = $state<string | null>(null);

  const opts = $derived(tile.options);
  const cpuTotal = $derived(opts?.cpu_total !== false);
  const byAdapter = $derived(Boolean(opts?.network_by_adapter));
  const byVolume = $derived(Boolean(opts?.disk_by_volume));
  const percentOnly = $derived(opts?.display_style === "percent_only");

  onMount(() => {
    void gateway
      .getPerfSummary()
      .then((r) => {
        summary = r;
      })
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
      });
  });

  const cpuDisplay = $derived(
    liveCpuPercent != null && Number.isFinite(liveCpuPercent) ? liveCpuPercent : (summary?.cpu_percent_total ?? 0),
  );
</script>

<Card size="xl" class="h-full overflow-auto">
  {#snippet children()}
    <div class="p-4">
      <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Performance</h3>
      {#if err}
        <p class="text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {:else if !summary}
        <p class="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      {:else if percentOnly}
        <ul class="space-y-1 font-mono text-sm text-gray-800 dark:text-gray-200">
          <li>CPU ({cpuTotal ? "total" : "per-core"}): {cpuTotal ? `${cpuDisplay.toFixed(1)}%` : (summary.cpu_core_percent ?? []).map((p) => `${p.toFixed(0)}%`).join(", ") || `${cpuDisplay.toFixed(1)}%`}</li>
          <li>RAM: {summary.memory_used_percent.toFixed(1)}%</li>
          <li>Disk: {(summary.disk_used_percent ?? 0).toFixed(1)}%</li>
        </ul>
      {:else}
        <div class="flex flex-wrap gap-2 justify-center" data-testid="perf-gauges">
          {#if cpuTotal}
            <SemicircleGauge label="CPU" percent={cpuDisplay} mini />
          {:else}
            {#each summary.cpu_core_percent ?? [cpuDisplay] as pct, i (i)}
              <SemicircleGauge label="Core {i}" percent={pct} mini />
            {/each}
          {/if}
          <SemicircleGauge
            label="RAM"
            percent={summary.memory_used_percent}
            mini
            sublabel={summary.memory_total_bytes != null && summary.memory_used_bytes != null
              ? `${(summary.memory_used_bytes / 1e9).toFixed(1)} / ${(summary.memory_total_bytes / 1e9).toFixed(1)} GiB`
              : undefined}
          />
          {#if byAdapter && summary.network_adapters?.length}
            {#each summary.network_adapters as a (a.name)}
              <SemicircleGauge
                label={a.name}
                percent={Math.min(100, (a.in_mbps + a.out_mbps) * 2)}
                mini
                sublabel={`↓${a.in_mbps.toFixed(1)} ↑${a.out_mbps.toFixed(1)} Mb/s`}
              />
            {/each}
          {:else}
            <SemicircleGauge
              label="Network"
              percent={Math.min(100, ((summary.network_in_mbps ?? 0) + (summary.network_out_mbps ?? 0)) * 2)}
              mini
              sublabel={`↓${(summary.network_in_mbps ?? 0).toFixed(1)} ↑${(summary.network_out_mbps ?? 0).toFixed(1)} Mb/s`}
            />
          {/if}
          {#if byVolume && summary.disk_volumes?.length}
            {#each summary.disk_volumes as v, i (`${i}-${v.label}`)}
              <SemicircleGauge label={v.label} percent={v.used_percent} mini />
            {/each}
          {:else}
            <SemicircleGauge label="Disk" percent={summary.disk_used_percent ?? 0} mini />
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}
</Card>
