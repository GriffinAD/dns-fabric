<script lang="ts">
  import type { DashboardTile } from "../../dashboard/types";
  import SectionDashboardTile from "./SectionDashboardTile.svelte";
  import { piholeCpDashboardData } from "../store/piholeCpDashboardDataStore";

  let { tile }: { tile: DashboardTile } = $props();

  const opts = $derived(
    tile.options as { section: string; title: string; widgetId: string; view?: string },
  );
  const dash = $derived($piholeCpDashboardData);
  const payload = $derived(dash ? dash.sections[opts.section] : undefined);
  const view = $derived(opts.view);
</script>

{#if dash}
  <SectionDashboardTile section={opts.section} title={opts.title} {view} payload={payload} />
{:else}
  <p class="text-sm text-slate-600 dark:text-gray-400">Loading dashboard…</p>
{/if}
