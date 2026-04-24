<script lang="ts">
  import Badge from "flowbite-svelte/Badge.svelte";
  import Card from "flowbite-svelte/Card.svelte";
  import Table from "flowbite-svelte/Table.svelte";
  import TableBody from "flowbite-svelte/TableBody.svelte";
  import TableBodyCell from "flowbite-svelte/TableBodyCell.svelte";
  import TableBodyRow from "flowbite-svelte/TableBodyRow.svelte";
  import TableHead from "flowbite-svelte/TableHead.svelte";
  import TableHeadCell from "flowbite-svelte/TableHeadCell.svelte";
  import { onMount } from "svelte";

  import type { DhcpReservation } from "../api/types";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let { gateway, tile }: { gateway: DataGateway; tile: DashboardTile } = $props();

  let items = $state<DhcpReservation[]>([]);
  let err = $state<string | null>(null);

  const isCompact = $derived(tile.displayMode === "compact");

  onMount(() => {
    void gateway
      .listDhcpReservations()
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
      <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Static reservations</h3>
      {#if err}
        <p class="text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {:else if items.length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400">No reservations.</p>
      {:else if isCompact}
        {@const r0 = items[0]}
        <p class="text-sm text-gray-700 dark:text-gray-200" data-testid="dhcp-reservations-compact">
          <span class="font-medium">{items.length}</span>
          {items.length === 1 ? " reservation" : " reservations"}
          {#if r0}
            <span class="font-mono text-gray-500 dark:text-gray-400"> · {r0.reserved_address}</span>
          {/if}
        </p>
      {:else}
        <Table hoverable={true}>
          <TableHead>
            <TableHeadCell>Category</TableHeadCell>
            <TableHeadCell>IP</TableHeadCell>
            <TableHeadCell>MAC</TableHeadCell>
            <TableHeadCell>Subnet</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each items as r (r.id)}
              <TableBodyRow>
                <TableBodyCell>
                  <Badge color="gray">{r.category ?? "STATIC"}</Badge>
                </TableBodyCell>
                <TableBodyCell class="font-mono text-xs">{r.reserved_address}</TableBodyCell>
                <TableBodyCell class="font-mono text-xs">{r.hardware_address}</TableBodyCell>
                <TableBodyCell>{r.subnet_cidr ?? "—"}</TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </div>
  {/snippet}
</Card>
