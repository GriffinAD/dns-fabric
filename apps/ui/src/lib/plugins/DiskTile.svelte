<script lang="ts">
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";
  import PerfMetricTile from "./PerfMetricTile.svelte";

  let {
    gateway,
    tile,
    onGridHint,
    alignColumnCount = 12,
    dashboardGaugeAlign = true,
  }: {
    gateway: DataGateway;
    tile: DashboardTile;
    onGridHint?: (hint: { colSpan: number; rowSpan: number }) => void;
    alignColumnCount?: number;
    dashboardGaugeAlign?: boolean;
  } = $props();
</script>

<PerfMetricTile {gateway} {tile} metric="disk" {onGridHint} {alignColumnCount} {dashboardGaugeAlign} />
