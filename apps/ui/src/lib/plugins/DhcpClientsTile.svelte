<script lang="ts">
  import { onMount } from "svelte";

  import type { DhcpClient } from "../api/types";
  import BaseDataTable from "../components/BaseDataTable.svelte";
  import type { BaseDataTableColumn, BaseDataTableSettingsPatch } from "../components/baseDataTable";
  import { defaultBaseDataTableSettings, mergeBaseDataTableSettings } from "../components/baseDataTable";
  import { dhcpClientsListUpdated, type FabricEventBus } from "../dashboard/eventBus";
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
  const title = $derived(`DHCP clients (${items.length})`);
  const emptyText = "No active clients.";

  const tableOptionsPatch = $derived(
    (tile.options as { table?: BaseDataTableSettingsPatch } | null | undefined)?.table,
  );

  const tableSettings = $derived(
    mergeBaseDataTableSettings(
      defaultBaseDataTableSettings,
      { allowEdit: true, allowRefresh: true },
      tableOptionsPatch,
    ),
  );

  const columns = $derived.by((): BaseDataTableColumn[] => [
    {
      header: "IP",
      accessor: (c) => (c as DhcpClient).assigned_address,
      cellClass: "font-mono text-xs",
    },
    {
      header: "Host",
      accessor: (c) => (c as DhcpClient).hostname ?? "—",
      fieldKey: "hostname",
      editable: true,
      editor: "text",
    },
    {
      header: "MAC",
      accessor: (c) => (c as DhcpClient).hardware_address,
      cellClass: "font-mono text-xs",
    },
    {
      header: "Vendor",
      accessor: (c) => (c as DhcpClient).vendor_name ?? "—",
      fieldKey: "vendor_name",
      editable: true,
      editor: "text",
      hideWhenCompact: true,
    },
    {
      header: "Lease ends",
      accessor: (c) => (c as DhcpClient).lease_expires_at ?? "—",
      hideWhenCompact: true,
      cellClass: "font-mono text-xs",
    },
  ]);

  function applyItems(next: DhcpClient[]) {
    items = next;
    err = null;
    loading = false;
  }

  function reload() {
    loading = true;
    void gateway
      .listDhcpClients()
      .then((r) => applyItems(r.items))
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
        loading = false;
      });
  }

  async function onCommit({ rowId, patch }: { rowId: string; patch: Record<string, unknown> }) {
    const wirePatch: { hostname?: string | null; vendor_name?: string | null } = {};
    if ("hostname" in patch) {
      wirePatch.hostname = patch.hostname == null ? null : String(patch.hostname);
    }
    if ("vendor_name" in patch) {
      wirePatch.vendor_name = patch.vendor_name == null ? null : String(patch.vendor_name);
    }
    const updated = await gateway.patchDhcpClient(rowId, wirePatch);
    items = items.map((row) => ((row as DhcpClient).id === rowId ? updated : row));
  }

  onMount(() => {
    return subscribeListWithInitialFetch({
      bus,
      topic: "fabric.dhcp.clients.updated",
      fetch: () => gateway.listDhcpClients(),
      parseItems: dhcpClientsListUpdated,
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
  rowKey={(c) => (c as DhcpClient).id}
  settings={tableSettings}
  onRetry={reload}
  onRefresh={reload}
  {onCommit}
/>
