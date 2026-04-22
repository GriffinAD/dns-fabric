<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";

  import { DataGateway } from "../dataGateway";
  import DhcpClientsTile from "../plugins/DhcpClientsTile.svelte";
  import DhcpPoolsTile from "../plugins/DhcpPoolsTile.svelte";
  import DhcpReservationsTile from "../plugins/DhcpReservationsTile.svelte";
  import DiscoveryTile from "../plugins/DiscoveryTile.svelte";
  import PerfTile from "../plugins/PerfTile.svelte";
  import type { DashboardLayout } from "./types";

  let {
    layout,
    gateway,
    liveCpuPercent,
  }: {
    layout: DashboardLayout;
    gateway: DataGateway;
    liveCpuPercent?: number | null;
  } = $props();
</script>

<div class="grid gap-4 md:grid-cols-2" data-testid="dashboard-host" aria-label="Dashboard tiles">
  {#each layout.tiles as tile (tile.id)}
    {#if tile.pluginId === "dhcp.pools"}
      <DhcpPoolsTile {gateway} {tile} />
    {:else if tile.pluginId === "dhcp.clients"}
      <DhcpClientsTile {gateway} {tile} />
    {:else if tile.pluginId === "dhcp.reservations"}
      <DhcpReservationsTile {gateway} {tile} />
    {:else if tile.pluginId === "discovery.records"}
      <DiscoveryTile {gateway} {tile} />
    {:else if tile.pluginId === "perf.summary"}
      <PerfTile {gateway} {tile} {liveCpuPercent} />
    {:else}
      <Card>
        {#snippet children()}
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{tile.pluginId}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">Unknown plugin (placeholder).</p>
        {/snippet}
      </Card>
    {/if}
  {/each}
</div>
