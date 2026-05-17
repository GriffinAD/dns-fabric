<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";

  import type { PerfSummaryResponse } from "../api/types";
  import MetricList from "../components/MetricList.svelte";
  import SemicircleGauge from "../components/SemicircleGauge.svelte";
  import { clampGridColSpan, tileColSpanForPlugin } from "./builtinMeta";
  import { perfUpdatedFullSummary, type FabricEventBus } from "../dashboard/eventBus";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";
  import { usePluginBusSubscription } from "./pluginDataBus";

  let {
    gateway,
    bus,
    tile,
  }: {
    gateway: DataGateway;
    bus: FabricEventBus;
    tile: DashboardTile;
  } = $props();

  let summary = $state<PerfSummaryResponse | null>(null);
  let err = $state<string | null>(null);

  const opts = $derived(tile.options);
  const cpuTotal = $derived(opts?.cpu_total === true);
  const byAdapter = $derived(Boolean(opts?.network_by_adapter));
  const byVolume = $derived(Boolean(opts?.disk_by_volume));
  const percentOnly = $derived(opts?.display_style === "percent_only");
  const gaugeGradientMode = $derived(opts?.gauge_gradient_mode ?? "smooth");

  usePluginBusSubscription(
    bus,
    "fabric.perf.updated",
    perfUpdatedFullSummary,
    async () => {
      try {
        const r = await gateway.getPerfSummary();
        err = null;
        return r;
      } catch (e: unknown) {
        err = e instanceof Error ? e.message : String(e);
        throw e;
      }
    },
    (snap) => {
      summary = snap;
    },
  );

  const effective = $derived(summary);

  const cpuDisplay = $derived(effective?.cpu_percent_total ?? 0);

  const percentLines = $derived.by((): string[] => {
    if (!effective) return [];
    const cores = (effective.cpu_core_percent ?? []).map((p) => p.toFixed(0) + "%").join(", ");
    const cpuLine = cpuTotal
      ? `CPU (total): ${cpuDisplay.toFixed(1)}%`
      : `CPU (per-core): ${cores || cpuDisplay.toFixed(1) + "%"}`;
    return [
      cpuLine,
      `RAM: ${effective.memory_used_percent.toFixed(1)}%`,
      `Disk: ${(effective.disk_used_percent ?? 0).toFixed(1)}%`,
    ];
  });

  type SummarySlot =
    | { key: string; kind: "cpu-total"; percent: number }
    | { key: string; kind: "core"; i: number; percent: number }
    | { key: string; kind: "ram"; percent: number; sublabel?: string }
    | { key: string; kind: "net-adapter"; name: string; percent: number; sublabel: string }
    | { key: string; kind: "net-one"; percent: number; sublabel: string }
    | { key: string; kind: "disk-vol"; label: string; percent: number }
    | { key: string; kind: "disk-one"; percent: number };

  const summarySlots = $derived.by((): SummarySlot[] => {
    if (!effective || percentOnly) return [];
    const out: SummarySlot[] = [];
    if (cpuTotal) {
      out.push({ key: "cpu-total", kind: "cpu-total", percent: cpuDisplay });
    } else {
      const cores = effective.cpu_core_percent ?? [cpuDisplay];
      for (let i = 0; i < cores.length; i++) {
        out.push({ key: `core-${i}`, kind: "core", i, percent: cores[i]! });
      }
    }
    const ramSub =
      effective.memory_total_bytes != null && effective.memory_used_bytes != null
        ? `${(effective.memory_used_bytes / 1e9).toFixed(1)} / ${(effective.memory_total_bytes / 1e9).toFixed(1)} GiB`
        : undefined;
    out.push({ key: "ram", kind: "ram", percent: effective.memory_used_percent, sublabel: ramSub });
    if (byAdapter && effective.network_adapters?.length) {
      for (const a of effective.network_adapters) {
        out.push({
          key: `na-${a.name}`,
          kind: "net-adapter",
          name: a.name,
          percent: Math.min(100, (a.in_mbps + a.out_mbps) * 2),
          sublabel: `↓${a.in_mbps.toFixed(1)} ↑${a.out_mbps.toFixed(1)} Mb/s`,
        });
      }
    } else {
      out.push({
        key: "net",
        kind: "net-one",
        percent: Math.min(100, ((effective.network_in_mbps ?? 0) + (effective.network_out_mbps ?? 0)) * 2),
        sublabel: `↓${(effective.network_in_mbps ?? 0).toFixed(1)} ↑${(effective.network_out_mbps ?? 0).toFixed(1)} Mb/s`,
      });
    }
    if (byVolume && effective.disk_volumes?.length) {
      for (let i = 0; i < effective.disk_volumes.length; i++) {
        const v = effective.disk_volumes[i]!;
        out.push({ key: `dv-${i}-${v.label}`, kind: "disk-vol", label: v.label, percent: v.used_percent });
      }
    } else {
      out.push({ key: "disk", kind: "disk-one", percent: effective.disk_used_percent ?? 0 });
    }
    return out;
  });

  const tileColSpanEff = $derived(
    Math.max(1, tile.grid?.colSpan != null ? clampGridColSpan(tile.grid.colSpan) : tileColSpanForPlugin(tile)),
  );
  const tileRowSpan = $derived(Math.max(1, tile.grid?.rowSpan ?? 1));
  const fillGauges = $derived(
    summarySlots.length > 1 || tileRowSpan > 1 || (summarySlots.length === 1 && tileColSpanEff > 1),
  );
  const summaryGridStyle = $derived(
    `grid-template-columns: repeat(${Math.max(1, summarySlots.length)}, minmax(0, 1fr)); column-gap: 0.25rem; justify-items: stretch; align-items: stretch;`,
  );
</script>

{#snippet oneGauge(s: SummarySlot)}
  {#if s.kind === "cpu-total"}
    <SemicircleGauge label="CPU" percent={s.percent} mini miniFillCell={fillGauges} gradientMode={gaugeGradientMode} />
  {:else if s.kind === "core"}
    <SemicircleGauge
      label="Core {s.i}"
      percent={s.percent}
      mini
      miniFillCell={fillGauges}
      gradientMode={gaugeGradientMode}
    />
  {:else if s.kind === "ram"}
    <SemicircleGauge
      label="RAM"
      percent={s.percent}
      mini
      miniFillCell={fillGauges}
      sublabel={s.sublabel}
      gradientMode={gaugeGradientMode}
    />
  {:else if s.kind === "net-adapter"}
    <SemicircleGauge
      label={s.name}
      percent={s.percent}
      mini
      miniFillCell={fillGauges}
      sublabel={s.sublabel}
      gradientMode={gaugeGradientMode}
    />
  {:else if s.kind === "net-one"}
    <SemicircleGauge
      label="Network"
      percent={s.percent}
      mini
      miniFillCell={fillGauges}
      sublabel={s.sublabel}
      gradientMode={gaugeGradientMode}
    />
  {:else if s.kind === "disk-vol"}
    <SemicircleGauge label={s.label} percent={s.percent} mini miniFillCell={fillGauges} gradientMode={gaugeGradientMode} />
  {:else}
    <SemicircleGauge label="Disk" percent={s.percent} mini miniFillCell={fillGauges} gradientMode={gaugeGradientMode} />
  {/if}
{/snippet}

<Card
  size="xl"
  class="box-border !max-w-full w-full min-w-0 flex-1 min-h-0 flex-col overflow-x-hidden overflow-y-auto"
>
  {#snippet children()}
    <div class="min-w-0 pt-2 pb-4">
      <h3 class="mb-3 px-4 text-lg font-semibold text-gray-900 dark:text-white">Performance</h3>
      {#if err}
        <p class="px-4 text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {:else if !summary}
        <p class="px-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      {:else if percentOnly}
        <div class="px-4">
          <MetricList lines={percentLines} class="space-y-1 font-mono text-sm text-gray-800 dark:text-gray-200" />
        </div>
      {:else if summarySlots.length}
        <div class="grid w-full min-w-0 [row-gap:0.25rem]" style={summaryGridStyle} data-testid="perf-gauges">
          {#each summarySlots as s (s.key)}
            <div class="min-w-0">
              {@render oneGauge(s)}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}
</Card>
