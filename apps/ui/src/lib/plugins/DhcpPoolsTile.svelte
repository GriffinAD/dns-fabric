<script lang="ts">
  import { onMount } from "svelte";

  import type { DhcpPool } from "../api/types";
  import TablePluginShell from "../components/TablePluginShell.svelte";
  import type { TableShellColumn } from "../components/tablePluginShell";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  let { gateway, tile }: { gateway: DataGateway; tile: DashboardTile } = $props();

  let items = $state<DhcpPool[]>([]);
  let err = $state<string | null>(null);

  const compact = $derived(tile.displayMode === "compact");

  const columns: TableShellColumn[] = [
    { header: "Subnet", accessor: (p) => (p as DhcpPool).subnet_cidr },
    { header: "Range", accessor: (p) => `${(p as DhcpPool).range_start} – ${(p as DhcpPool).range_end}` },
    { header: "Domain", accessor: (p) => (p as DhcpPool).dns_domain ?? "—", hideWhenCompact: true },
  ];

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
</script>

<TablePluginShell
  title="DHCP pools"
  {items}
  {err}
  emptyText="No pools."
  {compact}
  {columns}
  rowKey={(p) => (p as DhcpPool).id}
>
  {#snippet compactSummary()}
    {#if items.length > 0}
      {@const first = items[0]}
      <p class="text-sm text-gray-700 dark:text-gray-200" data-testid="dhcp-pools-compact">
        <span class="font-medium">{items.length}</span>
        {items.length === 1 ? " pool" : " pools"}
        {#if first}
          <span class="text-gray-500 dark:text-gray-400">
            · {first.subnet_cidr} ({first.range_start} – {first.range_end})</span>
        {/if}
      </p>
    {/if}
  {/snippet}
  {#snippet fullSingle()}
    {@const p = items[0]!}
    <div class="space-y-2 text-sm text-gray-700 dark:text-gray-200">
      <p><span class="font-medium">Range:</span> {p.range_start} – {p.range_end}</p>
      <p><span class="font-medium">Subnet:</span> {p.subnet_cidr}</p>
      {#if p.dns_domain}
        <p><span class="font-medium">Domain:</span> {p.dns_domain}</p>
      {/if}
    </div>
  {/snippet}
</TablePluginShell>
