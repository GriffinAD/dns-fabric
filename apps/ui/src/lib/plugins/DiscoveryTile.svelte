<script lang="ts">
  import Badge from "flowbite-svelte/Badge.svelte";
  import Button from "flowbite-svelte/Button.svelte";
  import Card from "flowbite-svelte/Card.svelte";
  import Table from "flowbite-svelte/Table.svelte";
  import TableBody from "flowbite-svelte/TableBody.svelte";
  import TableBodyCell from "flowbite-svelte/TableBodyCell.svelte";
  import TableBodyRow from "flowbite-svelte/TableBodyRow.svelte";
  import TableHead from "flowbite-svelte/TableHead.svelte";
  import TableHeadCell from "flowbite-svelte/TableHeadCell.svelte";
  import { onMount } from "svelte";

  import type { DiscoveryRecord } from "../api/types";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let { gateway, tile }: { gateway: DataGateway; tile: DashboardTile } = $props();

  let records = $state<DiscoveryRecord[]>([]);
  let scanState = $state<string>("—");
  let lastUpdate = $state<string>("—");
  let busy = $state(false);
  let err = $state<string | null>(null);

  async function refresh() {
    err = null;
    try {
      const [rec, scan] = await Promise.all([gateway.listDiscoveryRecords(), gateway.getDiscoveryScan()]);
      records = rec.items;
      scanState = scan.state;
      lastUpdate = scan.updated_at;
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : String(e);
    }
  }

  async function togglePause() {
    busy = true;
    err = null;
    try {
      const scan = await gateway.getDiscoveryScan();
      const nextPaused = scan.state !== "paused";
      const updated = await gateway.pauseDiscoveryScan(nextPaused);
      scanState = updated.state;
      lastUpdate = updated.updated_at;
    } catch (e: unknown) {
      err = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    void refresh();
  });

  const badgeColor = $derived(
    scanState === "running" ? "green" : scanState === "paused" ? "yellow" : "gray",
  );
</script>

<Card class="h-full max-h-[560px] overflow-auto">
  {#snippet children()}
    <div class="p-4">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="discovery-toolbar">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">Last update</span>
          <span class="font-mono text-sm text-gray-900 dark:text-white">{lastUpdate}</span>
          <Badge color={badgeColor}>{scanState}</Badge>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button type="button" color="alternative" size="sm" disabled={busy} onclick={() => void togglePause()}>
            {scanState === "paused" ? "Resume" : "Pause"}
          </Button>
          <Button type="button" size="sm" class="bg-gradient-to-r from-primary-600 to-primary-400" onclick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </div>
      {#if err}
        <p class="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {/if}
      <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Discovery records</h3>
      {#if records.length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400">No records.</p>
      {:else}
        <Table hoverable={true}>
          <TableHead>
            <TableHeadCell>ID</TableHeadCell>
            <TableHeadCell>State</TableHeadCell>
            <TableHeadCell>Addresses</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each records as r (r.id)}
              <TableBodyRow>
                <TableBodyCell class="font-mono text-xs">{r.id}</TableBodyCell>
                <TableBodyCell>{r.state}</TableBodyCell>
                <TableBodyCell class="text-xs">{(r.addresses ?? []).join(", ") || "—"}</TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </div>
  {/snippet}
</Card>
