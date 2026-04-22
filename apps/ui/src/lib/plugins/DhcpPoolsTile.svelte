<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import Table from "flowbite-svelte/Table.svelte";
  import TableBody from "flowbite-svelte/TableBody.svelte";
  import TableBodyCell from "flowbite-svelte/TableBodyCell.svelte";
  import TableBodyRow from "flowbite-svelte/TableBodyRow.svelte";
  import TableHead from "flowbite-svelte/TableHead.svelte";
  import TableHeadCell from "flowbite-svelte/TableHeadCell.svelte";
  import { onMount } from "svelte";

  import type { DhcpPool } from "../api/types";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let { gateway, tile }: { gateway: DataGateway; tile: DashboardTile } = $props();

  let items = $state<DhcpPool[]>([]);
  let err = $state<string | null>(null);

  onMount(() => {
    void gateway
      .listDhcpPools()
      .then((r) => {
        items = r.items;
      })
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
      });
  });

  const singleCard = $derived(items.length === 1);
</script>

<Card class="h-full max-h-[480px] overflow-auto">
  {#snippet children()}
    <div class="p-4">
      <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">DHCP pools</h3>
      {#if err}
        <p class="text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {:else if items.length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400">No pools.</p>
      {:else if singleCard}
        {@const p = items[0]}
        <div class="space-y-2 text-sm text-gray-700 dark:text-gray-200">
          <p><span class="font-medium">Range:</span> {p.range_start} – {p.range_end}</p>
          <p><span class="font-medium">Subnet:</span> {p.subnet_cidr}</p>
          {#if p.dns_domain}
            <p><span class="font-medium">Domain:</span> {p.dns_domain}</p>
          {/if}
        </div>
      {:else}
        <Table hoverable={true}>
          <TableHead>
            <TableHeadCell>Subnet</TableHeadCell>
            <TableHeadCell>Range</TableHeadCell>
            <TableHeadCell>Domain</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each items as p (p.id)}
              <TableBodyRow>
                <TableBodyCell>{p.subnet_cidr}</TableBodyCell>
                <TableBodyCell>{p.range_start} – {p.range_end}</TableBodyCell>
                <TableBodyCell>{p.dns_domain ?? "—"}</TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </div>
  {/snippet}
</Card>
