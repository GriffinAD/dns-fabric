<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import { onMount } from "svelte";

  import type { PerfSummaryResponse } from "../api/types";
  import SemicircleGauge from "../components/SemicircleGauge.svelte";
  import { columnSpansOn } from "../dashboard/gaugeGridLayout";
  import { clampGridColSpan, GRID_COLUMNS } from "../dashboard/gridPlacement";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let {
    gateway,
    tile,
    metric,
    liveCpuPercent,
    onGridHint,
    /** Root grid: align semicircle sub-grid to main 12-col rhythm. In a container, set false so gauges only fill the tile (no extra virtual column math). */
    alignColumnCount = 12,
    dashboardGaugeAlign = true,
  }: {
    gateway: DataGateway;
    tile: DashboardTile;
    metric: "cpu" | "ram" | "network" | "disk";
    liveCpuPercent?: number | null;
    /** Dashboard grid: colSpan matches intratile gauge column count (capped; single-gauge = 1×1). */
    onGridHint?: (hint: { colSpan: number; rowSpan: number }) => void;
    alignColumnCount?: number;
    dashboardGaugeAlign?: boolean;
  } = $props();

  let summary = $state<PerfSummaryResponse | null>(null);
  let err = $state<string | null>(null);

  const title = $derived(
    metric === "cpu" ? "CPU" : metric === "ram" ? "RAM" : metric === "network" ? "Network" : "Disk",
  );

  const opts = $derived(tile.options);
  /** `cpu_total === true` = one combined gauge; omitted/false = one mini gauge per core (default). */
  const cpuTotal = $derived(opts?.cpu_total === true);
  const byAdapter = $derived(Boolean(opts?.network_by_adapter));
  const byVolume = $derived(Boolean(opts?.disk_by_volume));
  const percentOnly = $derived(opts?.display_style === "percent_only");

  const perfMaxCols = $derived(
    opts?.perf_max_cols !== undefined ? clampGridColSpan(opts.perf_max_cols) : GRID_COLUMNS,
  );

  /** Intratile grid columns; dashboard colSpan matches (no extra width for a lone gauge). */
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

  const stretchGaugesToCells = $derived(layoutMeta.gaugeCols > 1);

  /** Actual number of semicircles shown (can exceed `layoutMeta.gaugeCols` when many CPU cores; dashboard hint is capped at 12). */
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

  const alignTracks = $derived(
    Math.max(1, Math.min(GRID_COLUMNS, Math.floor(alignColumnCount || 12))),
  );
  /** At least the dashboard align count, and at least one column per semicircle so `columnSpansOn` is solvable. */
  const layoutTracks = $derived(
    nGaugeCells <= 0 ? alignTracks : Math.max(alignTracks, Math.min(GRID_COLUMNS, nGaugeCells)),
  );
  const intratileColSpans = $derived(
    nGaugeCells <= 0 || !dashboardGaugeAlign
      ? null
      : columnSpansOn(layoutTracks, nGaugeCells),
  );
  const gaugeFrFallback = $derived(
    intratileColSpans == null
      ? `grid-template-columns: repeat(${Math.max(1, nGaugeCells)}, minmax(0, 1fr)); justify-items: stretch; align-items: stretch;`
      : null,
  );
  const alignGridStyle = $derived(
    intratileColSpans == null
      ? gaugeFrFallback
      : `grid-template-columns: repeat(${layoutTracks}, minmax(0, 1fr)); column-gap: 0; justify-items: stretch; align-items: stretch;`,
  );

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

<Card
  size="xl"
  class="box-border h-full !max-w-full w-full min-w-0 flex-1 min-h-0 flex-col overflow-x-hidden overflow-y-auto"
>
  {#snippet children()}
    <div class="flex h-full min-h-0 w-full min-w-0 flex-col px-1.5 py-1 sm:px-2 sm:py-1.5">
      <h3 class="mb-0.5 shrink-0 text-center text-xs font-semibold leading-tight text-gray-900 dark:text-white">
        {title}
      </h3>
      {#if err}
        <p
          class="flex flex-1 items-center justify-center text-center text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          {err}
        </p>
      {:else if !summary}
        <p class="flex flex-1 items-center justify-center text-center text-xs text-gray-500 dark:text-gray-400">
          Loading…
        </p>
      {:else if percentOnly}
        <div
          class="flex min-h-0 flex-1 flex-col items-stretch justify-center sm:items-center"
        >
          {#if metric === "cpu"}
            <ul class="space-y-0.5 font-mono text-xs text-gray-800 dark:text-gray-200">
              <li>
                CPU ({cpuTotal ? "total" : "per-core"}): {cpuTotal
                  ? `${cpuDisplay.toFixed(1)}%`
                  : (summary.cpu_core_percent ?? []).map((p) => `${p.toFixed(0)}%`).join(", ") || `${cpuDisplay.toFixed(1)}%`}
              </li>
            </ul>
          {:else if metric === "ram"}
            <ul class="space-y-0.5 font-mono text-xs text-gray-800 dark:text-gray-200">
              <li>RAM: {summary.memory_used_percent.toFixed(1)}%</li>
            </ul>
          {:else if metric === "network"}
            <ul class="space-y-0.5 font-mono text-xs text-gray-800 dark:text-gray-200">
              <li>Network: {((summary.network_in_mbps ?? 0) + (summary.network_out_mbps ?? 0)).toFixed(1)} Mb/s (Σ)</li>
            </ul>
          {:else}
            <ul class="space-y-0.5 font-mono text-xs text-gray-800 dark:text-gray-200">
              <li>Disk: {(summary.disk_used_percent ?? 0).toFixed(1)}%</li>
            </ul>
          {/if}
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
                <div
                  class="min-w-0"
                  style:grid-column={intratileColSpans?.[0] == null
                    ? undefined
                    : `span ${intratileColSpans[0]!}`}
                >
                  <SemicircleGauge
                    labelBlank
                    percent={cpuDisplay}
                    mini
                    miniFillCell={stretchGaugesToCells}
                  />
                </div>
              {:else}
                {#each summary.cpu_core_percent ?? [cpuDisplay] as pct, i (i)}
                  <div
                    class="min-w-0"
                    style:grid-column={intratileColSpans?.[i] == null
                      ? undefined
                      : `span ${intratileColSpans[i]!}`}
                  >
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
              <div
                class="min-w-0"
                style:grid-column={intratileColSpans?.[0] == null
                  ? undefined
                  : `span ${intratileColSpans[0]!}`}
              >
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
                  <div
                    class="min-w-0"
                    style:grid-column={intratileColSpans?.[i] == null
                      ? undefined
                      : `span ${intratileColSpans[i]!}`}
                  >
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
                <div
                  class="min-w-0"
                  style:grid-column={intratileColSpans?.[0] == null
                    ? undefined
                    : `span ${intratileColSpans[0]!}`}
                >
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
                  <div
                    class="min-w-0"
                    style:grid-column={intratileColSpans?.[i] == null
                      ? undefined
                      : `span ${intratileColSpans[i]!}`}
                  >
                    <SemicircleGauge
                      label={v.label}
                      percent={v.used_percent}
                      mini
                      miniFillCell={stretchGaugesToCells}
                    />
                  </div>
                {/each}
              {:else}
                <div
                  class="min-w-0"
                  style:grid-column={intratileColSpans?.[0] == null
                    ? undefined
                    : `span ${intratileColSpans[0]!}`}
                >
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
    </div>
  {/snippet}
</Card>
