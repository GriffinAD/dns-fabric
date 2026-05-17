<script lang="ts">
  import { onMount } from "svelte";

  import type { DhcpClient } from "../../api/types";
  import BaseDataTable from "../../components/baseDataTable/BaseDataTable.svelte";
  import type { BaseDataTableColumn, BaseDataTableSettingsPatch } from "../../components/baseDataTable/baseDataTable";
  import { defaultBaseDataTableSettings, mergeBaseDataTableSettings } from "../../components/baseDataTable/baseDataTable";
  import { DataGateway } from "../../dataGateway";
  import type { DashboardTile } from "../../dashboard/types";

  let {
    gateway,
    tile,
  }: {
    gateway: DataGateway;
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

  function load() {
    err = null;
    loading = true;
    void gateway
      .listDhcpClients()
      .then((r) => {
        items = r.items;
      })
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
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

  onMount(load);
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
  onRetry={load}
  onRefresh={load}
  {onCommit}
/>
