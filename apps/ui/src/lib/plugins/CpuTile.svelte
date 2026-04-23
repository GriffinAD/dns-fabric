<script lang="ts">
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";
  import PerfMetricTile from "./PerfMetricTile.svelte";

  let {
    gateway,
    tile,
    liveCpuPercent,
    onGridHint,
    alignColumnCount = 12,
    dashboardGaugeAlign = true,
  }: {
    gateway: DataGateway;
    tile: DashboardTile;
    liveCpuPercent?: number | null;
    onGridHint?: (hint: { colSpan: number; rowSpan: number }) => void;
    alignColumnCount?: number;
    dashboardGaugeAlign?: boolean;
  } = $props();
</script>

<PerfMetricTile {gateway} {tile} metric="cpu" {liveCpuPercent} {onGridHint} {alignColumnCount} {dashboardGaugeAlign} />
