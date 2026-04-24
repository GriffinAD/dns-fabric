<script lang="ts">
  import { getContext, onMount } from "svelte";

  import type { PerfSummaryResponse } from "../api/types";
  import GaugeTileLayout from "../components/GaugeTileLayout.svelte";
  import MetricList from "../components/MetricList.svelte";
  import SemicircleGauge from "../components/SemicircleGauge.svelte";
  import { clampGridColSpan, GRID_COLUMNS, tileColSpanForPlugin } from "./builtinMeta";
  import { FABRIC_EVENT_BUS, perfUpdatedCpuPercent, type FabricEventBus } from "../dashboard/eventBus";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let {
    gateway,
    tile,
    metric,
    onGridHint,
  }: {
    gateway: DataGateway;
    tile: DashboardTile;
    metric: "cpu" | "ram" | "network" | "disk";
    onGridHint?: (hint: { colSpan: number; rowSpan: number }) => void;
  } = $props();

  const fabricBus = getContext<FabricEventBus | undefined>(FABRIC_EVENT_BUS);

  let summary = $state<PerfSummaryResponse | null>(null);
  let err = $state<string | null>(null);
  let liveCpuPercent = $state<number | null>(null);

  const title = $derived(
    metric === "cpu" ? "CPU" : metric === "ram" ? "RAM" : metric === "network" ? "Network" : "Disk",
  );

  const opts = $derived(tile.options);
  const cpuTotal = $derived(opts?.cpu_total === true);
  const byAdapter = $derived(Boolean(opts?.network_by_adapter));
  const byVolume = $derived(Boolean(opts?.disk_by_volume));
  const percentOnly = $derived(opts?.display_style === "percent_only");

  const perfMaxCols = $derived(
    opts?.perf_max_cols !== undefined ? clampGridColSpan(opts.perf_max_cols) : GRID_COLUMNS,
  );

  const layoutMeta = $derived.by(() => {
    if (!summary) return { gaugeCols: 1, dashboardCols: 1, effectKey: null as string | null };
    if (percentOnly) return { gaugeCols: 1, dashboardCols: 1, effectKey: "pct" as const };
    let n = 1;
    if (metric === "cpu") {
      n = cpuTotal ? 1 : Math.max(1, summary.cpu_core_percent?.length ?? 1);
    } else if (metric === "ram") {
      n = 1;
    } else if (metric === "network") {
      n = byAdapter ? Math.max(1, summary.network_adapters?.length ?? 1) : 1;
    } else {
      n = byVolume ? Math.max(1, summary.disk_volumes?.length ?? 1) : 1;
    }
    const gaugeCols = clampGridColSpan(Math.min(Math.max(1, n), perfMaxCols));
    const dashboardCols = gaugeCols;
    return { gaugeCols, dashboardCols, effectKey: `i${gaugeCols}-d${dashboardCols}` as const };
  });

  const tileColSpanEff = $derived(
    Math.max(1, tile.grid?.colSpan != null ? clampGridColSpan(tile.grid.colSpan) : tileColSpanForPlugin(tile)),
  );
  const tileRowSpan = $derived(Math.max(1, tile.grid?.rowSpan ?? 1));

  const nGaugeCells = $derived.by(() => {
    if (!summary || percentOnly) return 0;
    if (metric === "cpu") {
      return cpuTotal ? 1 : Math.max(1, summary.cpu_core_percent?.length ?? 1);
    }
    if (metric === "ram") return 1;
    if (metric === "network") {
      return byAdapter && summary.network_adapters?.length ? summary.network_adapters.length : 1;
    }
    return byVolume && summary.disk_volumes?.length ? summary.disk_volumes.length : 1;
  });

  const stretchGaugesToCells = $derived.by(() => {
    if (percentOnly) return false;
    if (layoutMeta.gaugeCols > 1) return true;
    if (tileRowSpan > 1) return true;
    if (nGaugeCells === 1 && tileColSpanEff > 1) return true;
    return false;
  });

  const alignGridStyle = $derived.by(() => {
    const n = Math.max(1, nGaugeCells);
    if (n === 1) {
      return `grid-template-columns: minmax(0, 1fr); justify-items: stretch; align-items: stretch;`;
    }
    return `grid-template-columns: repeat(${n}, minmax(0, 1fr)); column-gap: 0.25rem; justify-items: stretch; align-items: stretch;`;
  });

  onMount(() => {
    void gateway
      .getPerfSummary()
      .then((r) => {
        summary = r;
      })
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
      });

    if (!fabricBus) return;
    return fabricBus.subscribe("fabric.perf.updated", perfUpdatedCpuPercent, (v) => {
      liveCpuPercent = v;
    });
  });

  const cpuDisplay = $derived(
    liveCpuPercent != null && Number.isFinite(liveCpuPercent) ? liveCpuPercent : (summary?.cpu_percent_total ?? 0),
  );

  const percentLines = $derived.by((): string[] => {
    if (!summary) return [];
    if (metric === "cpu") {
      const cores = (summary.cpu_core_percent ?? []).map((p) => p.toFixed(0) + "%").join(", ");
      const line = cpuTotal
        ? `CPU (total): ${cpuDisplay.toFixed(1)}%`
        : `CPU (per-core): ${cores || cpuDisplay.toFixed(1) + "%"}`;
      return [line];
    }
    if (metric === "ram") return [`RAM: ${summary.memory_used_percent.toFixed(1)}%`];
    if (metric === "network") {
      return [
        `Network: ${((summary.network_in_mbps ?? 0) + (summary.network_out_mbps ?? 0)).toFixed(1)} Mb/s (Σ)`,
      ];
    }
    return [`Disk: ${(summary.disk_used_percent ?? 0).toFixed(1)}%`];
  });

  let lastGridKey = $state<string | null>(null);

  $effect(() => {
    if (!onGridHint || !summary) return;
    const { effectKey, dashboardCols } = layoutMeta;
    if (effectKey === null) return;
    if (lastGridKey === effectKey) return;
    lastGridKey = effectKey;
    onGridHint({ colSpan: dashboardCols, rowSpan: 1 });
  });
</script>

<GaugeTileLayout {title} {err} loading={!summary} bodyClass="flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch justify-center">
  {#snippet children()}
    {#if summary}
      {#if percentOnly}
        <div class="flex min-h-0 flex-1 flex-col items-stretch justify-center sm:items-center">
          <MetricList lines={percentLines} />
        </div>
      {:else}
        <div
          class="flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch justify-center"
          data-testid="perf-metric-body"
        >
          {#if metric === "cpu"}
            <div
              class="grid w-full min-w-0 max-w-full [row-gap:0.25rem]"
              style={alignGridStyle}
              data-testid="perf-metric-gauges"
            >
              {#if cpuTotal}
                <div class="min-w-0">
                  <SemicircleGauge
                    labelBlank
                    percent={cpuDisplay}
                    mini
                    miniFillCell={stretchGaugesToCells}
                  />
                </div>
              {:else}
                {#each summary.cpu_core_percent ?? [cpuDisplay] as pct, i (i)}
                  <div class="min-w-0">
                    <SemicircleGauge
                      label="Core {i}"
                      percent={pct}
                      mini
                      miniFillCell={stretchGaugesToCells}
                    />
                  </div>
                {/each}
              {/if}
            </div>
          {:else if metric === "ram"}
            <div
              class="grid w-full min-w-0 max-w-full justify-items-stretch"
              style={alignGridStyle}
              data-testid="perf-metric-gauges"
            >
              <div class="min-w-0">
                <SemicircleGauge
                  labelBlank
                  percent={summary.memory_used_percent}
                  mini
                  miniFillCell={stretchGaugesToCells}
                  sublabel={summary.memory_total_bytes != null && summary.memory_used_bytes != null
                    ? `${(summary.memory_used_bytes / 1e9).toFixed(1)} / ${(summary.memory_total_bytes / 1e9).toFixed(1)} GiB`
                    : undefined}
                />
              </div>
            </div>
          {:else if metric === "network"}
            <div
              class="grid w-full min-w-0 max-w-full [row-gap:0.25rem]"
              style={alignGridStyle}
              data-testid="perf-metric-gauges"
            >
              {#if byAdapter && summary.network_adapters?.length}
                {#each summary.network_adapters as a, i (a.name)}
                  <div class="min-w-0">
                    <SemicircleGauge
                      label={a.name}
                      percent={Math.min(100, (a.in_mbps + a.out_mbps) * 2)}
                      mini
                      miniFillCell={stretchGaugesToCells}
                      sublabel={`↓${a.in_mbps.toFixed(1)} ↑${a.out_mbps.toFixed(1)}`}
                    />
                  </div>
                {/each}
              {:else}
                <div class="min-w-0">
                  <SemicircleGauge
                    labelBlank
                    percent={Math.min(100, ((summary.network_in_mbps ?? 0) + (summary.network_out_mbps ?? 0)) * 2)}
                    mini
                    miniFillCell={stretchGaugesToCells}
                    sublabel={`↑${(summary.network_out_mbps ?? 0).toFixed(2)} ↓${(summary.network_in_mbps ?? 0).toFixed(2)} Mb/s`}
                  />
                </div>
              {/if}
            </div>
          {:else}
            <div
              class="grid w-full min-w-0 max-w-full [row-gap:0.25rem]"
              style={alignGridStyle}
              data-testid="perf-metric-gauges"
            >
              {#if byVolume && summary.disk_volumes?.length}
                {#each summary.disk_volumes as v, i (`${i}-${v.label}`)}
                  <div class="min-w-0">
                    <SemicircleGauge
                      label={v.label}
                      percent={v.used_percent}
                      mini
                      miniFillCell={stretchGaugesToCells}
                    />
                  </div>
                {/each}
              {:else}
                <div class="min-w-0">
                  <SemicircleGauge
                    labelBlank
                    percent={summary.disk_used_percent ?? 0}
                    mini
                    miniFillCell={stretchGaugesToCells}
                  />
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  {/snippet}
</GaugeTileLayout>
