<script lang="ts">
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";
  import PerfMetricTile from "./PerfMetricTile.svelte";

  let {
    gateway,
    tile,
    onGridHint,
  }: {
    gateway: DataGateway;
    tile: DashboardTile;
    onGridHint?: (hint: { colSpan: number; rowSpan: number }) => void;
  } = $props();
</script>

<PerfMetricTile {gateway} {tile} metric="cpu" {onGridHint} />
