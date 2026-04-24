<script lang="ts">
  import { onMount } from "svelte";

  import type { DhcpReservation } from "../api/types";
  import TablePluginShell from "../components/TablePluginShell.svelte";
  import type { TableShellColumn } from "../components/tablePluginShell";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let { gateway, tile }: { gateway: DataGateway; tile: DashboardTile } = $props();

  let items = $state<DhcpReservation[]>([]);
  let err = $state<string | null>(null);

  const compact = $derived(tile.displayMode === "compact");

  const columns: TableShellColumn[] = [
    { header: "Category", accessor: (r) => (r as DhcpReservation).category ?? "STATIC", hideWhenCompact: true },
    {
      header: "IP",
      accessor: (r) => (r as DhcpReservation).reserved_address,
      cellClass: "font-mono text-xs",
    },
    {
      header: "MAC",
      accessor: (r) => (r as DhcpReservation).hardware_address,
      cellClass: "font-mono text-xs",
    },
    { header: "Subnet", accessor: (r) => (r as DhcpReservation).subnet_cidr ?? "—", hideWhenCompact: true },
  ];

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

<TablePluginShell
  title="Static reservations"
  {items}
  {err}
  emptyText="No reservations."
  {compact}
  {columns}
  rowKey={(r) => (r as DhcpReservation).id}
>
  {#snippet compactSummary()}
    {#if items.length > 0}
      {@const r0 = items[0]}
      <p class="text-sm text-gray-700 dark:text-gray-200" data-testid="dhcp-reservations-compact">
        <span class="font-medium">{items.length}</span>
        {items.length === 1 ? " reservation" : " reservations"}
        {#if r0}
          <span class="font-mono text-gray-500 dark:text-gray-400"> · {r0.reserved_address}</span>
        {/if}
      </p>
    {/if}
  {/snippet}
</TablePluginShell>
