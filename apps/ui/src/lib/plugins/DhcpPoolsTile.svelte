<script lang="ts">
  import { onMount } from "svelte";

  import type { DhcpPool } from "../api/types";
  import BaseDataTable from "../components/BaseDataTable.svelte";
  import type { BaseDataTableColumn, BaseDataTableSettingsPatch } from "../components/baseDataTable";
  import { defaultBaseDataTableSettings, mergeBaseDataTableSettings } from "../components/baseDataTable";
  import { dhcpPoolsListUpdated, type FabricEventBus } from "../dashboard/eventBus";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";
  import { subscribeListWithInitialFetch } from "./pluginDataBus";

  let {
    gateway,
    bus,
    tile,
  }: {
    gateway: DataGateway;
    bus: FabricEventBus;
    tile: DashboardTile;
  } = $props();

  let items = $state<unknown[]>([]);
  let err = $state<string | null>(null);
  let loading = $state(true);

  const compact = $derived(tile.displayMode === "compact");
  const title = $derived(`DHCP pools (${items.length})`);
  const emptyText = "No pools.";

  const tableOptionsPatch = $derived(
    (tile.options as { table?: BaseDataTableSettingsPatch } | null | undefined)?.table,
  );

  const tableSettings = $derived(
    mergeBaseDataTableSettings(
      defaultBaseDataTableSettings,
      {
        allowEdit: false,
        allowRefresh: true,
        allowFilter: false,
        allowExportCsv: false,
        allowExportJson: false,
        allowModal: false,
        interactionMode: "modal",
      },
      tableOptionsPatch,
    ),
  );

  const columns = $derived.by((): BaseDataTableColumn[] => [
    { header: "Subnet", accessor: (p) => (p as DhcpPool).subnet_cidr },
    { header: "Range", accessor: (p) => `${(p as DhcpPool).range_start} – ${(p as DhcpPool).range_end}` },
    { header: "Domain", accessor: (p) => (p as DhcpPool).dns_domain ?? "—", hideWhenCompact: true },
  ]);

  function applyItems(next: DhcpPool[]) {
    items = next;
    err = null;
    loading = false;
  }

  function reload() {
    loading = true;
    void gateway
      .listDhcpPools()
      .then((r) => applyItems(r.items))
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
        loading = false;
      });
  }

  onMount(() => {
    return subscribeListWithInitialFetch({
      bus,
      topic: "fabric.dhcp.pools.updated",
      fetch: () => gateway.listDhcpPools(),
      parseItems: dhcpPoolsListUpdated,
      onItems: applyItems,
    });
  });
</script>

<BaseDataTable
  {title}
  {items}
  {err}
  {loading}
  {emptyText}
  {compact}
  {columns}
  rowKey={(p) => (p as DhcpPool).id}
  settings={tableSettings}
  onRetry={reload}
  onRefresh={reload}
>
  {#snippet compactSummary()}
    {#if items.length > 0}
      {@const first = items[0] as DhcpPool}
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
    {@const p = items[0] as DhcpPool}
    <div class="space-y-2 text-sm text-gray-700 dark:text-gray-200">
      <p><span class="font-medium">Range:</span> {p.range_start} – {p.range_end}</p>
      <p><span class="font-medium">Subnet:</span> {p.subnet_cidr}</p>
      {#if p.dns_domain}
        <p><span class="font-medium">Domain:</span> {p.dns_domain}</p>
      {/if}
    </div>
  {/snippet}
</BaseDataTable>
