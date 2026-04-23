<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import Table from "flowbite-svelte/Table.svelte";
  import TableBody from "flowbite-svelte/TableBody.svelte";
  import TableBodyCell from "flowbite-svelte/TableBodyCell.svelte";
  import TableBodyRow from "flowbite-svelte/TableBodyRow.svelte";
  import TableHead from "flowbite-svelte/TableHead.svelte";
  import TableHeadCell from "flowbite-svelte/TableHeadCell.svelte";
  import { onMount } from "svelte";

  import type { DhcpClient } from "../api/types";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let { gateway, tile }: { gateway: DataGateway; tile: DashboardTile } = $props();

  let items = $state<DhcpClient[]>([]);
  let err = $state<string | null>(null);

  const compact = $derived(tile.displayMode === "compact");

  onMount(() => {
    void gateway
      .listDhcpClients()
      .then((r) => {
        items = r.items;
      })
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
      });
  });
</script>

<Card
  size="xl"
  class="box-border !max-w-full w-full min-w-0 max-h-[480px] flex-1 min-h-0 flex-col overflow-auto"
>
  {#snippet children()}
    <div class="p-4">
      <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">DHCP clients</h3>
      {#if err}
        <p class="text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {:else if items.length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400">No active clients.</p>
      {:else}
        <Table hoverable={true}>
          <TableHead>
            <TableHeadCell>IP</TableHeadCell>
            <TableHeadCell>Host</TableHeadCell>
            <TableHeadCell>MAC</TableHeadCell>
            {#if !compact}
              <TableHeadCell>Vendor</TableHeadCell>
              <TableHeadCell>Lease ends</TableHeadCell>
            {/if}
          </TableHead>
          <TableBody>
            {#each items as c (c.id)}
              <TableBodyRow>
                <TableBodyCell class="font-mono text-xs">{c.assigned_address}</TableBodyCell>
                <TableBodyCell>{c.hostname ?? "—"}</TableBodyCell>
                <TableBodyCell class="font-mono text-xs">{c.hardware_address}</TableBodyCell>
                {#if !compact}
                  <TableBodyCell>{c.vendor_name ?? "—"}</TableBodyCell>
                  <TableBodyCell class="font-mono text-xs">{c.lease_expires_at ?? "—"}</TableBodyCell>
                {/if}
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </div>
  {/snippet}
</Card>
