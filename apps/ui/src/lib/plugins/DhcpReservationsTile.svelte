<script lang="ts">
  import { onMount } from "svelte";

  import type { DhcpReservation } from "../api/types";
  import BaseDataTable from "../components/BaseDataTable.svelte";
  import type { BaseDataTableColumn, BaseDataTableSettingsPatch } from "../components/baseDataTable";
  import { defaultBaseDataTableSettings, mergeBaseDataTableSettings } from "../components/baseDataTable";
  import { validateIpv4Address, validateMacAddress } from "../components/netValidation";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

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
  const title = $derived(`Static reservations (${items.length})`);
  const emptyText = "No reservations.";

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
      header: "Category",
      accessor: (r) => (r as DhcpReservation).category ?? "STATIC",
      hideWhenCompact: true,
    },
    {
      header: "IP",
      accessor: (r) => (r as DhcpReservation).reserved_address,
      cellClass: "font-mono text-xs",
      fieldKey: "reserved_address",
      editable: true,
      editor: "text",
      validate: validateIpv4Address,
    },
    {
      header: "MAC",
      accessor: (r) => (r as DhcpReservation).hardware_address,
      cellClass: "font-mono text-xs",
      fieldKey: "hardware_address",
      editable: true,
      editor: "text",
      validate: validateMacAddress,
    },
    {
      header: "Hostname",
      accessor: (r) => (r as DhcpReservation).hostname ?? "—",
      fieldKey: "hostname",
      editable: true,
      editor: "text",
    },
    {
      header: "Subnet",
      accessor: (r) => (r as DhcpReservation).subnet_cidr ?? "—",
      hideWhenCompact: true,
    },
  ]);

  function load() {
    err = null;
    loading = true;
    void gateway
      .listDhcpReservations()
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
    const wirePatch: {
      hardware_address?: string;
      reserved_address?: string;
      hostname?: string | null;
    } = {};
    if ("hardware_address" in patch) {
      wirePatch.hardware_address = String(patch.hardware_address ?? "");
    }
    if ("reserved_address" in patch) {
      wirePatch.reserved_address = String(patch.reserved_address ?? "");
    }
    if ("hostname" in patch) {
      wirePatch.hostname = patch.hostname == null ? null : String(patch.hostname);
    }
    const updated = await gateway.patchDhcpReservation(rowId, wirePatch);
    items = items.map((row) => ((row as DhcpReservation).id === rowId ? updated : row));
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
  rowKey={(r) => (r as DhcpReservation).id}
  settings={tableSettings}
  onRetry={load}
  onRefresh={load}
  {onCommit}
>
  {#snippet compactSummary()}
    {#if items.length > 0}
      {@const r0 = items[0] as DhcpReservation}
      <p class="text-sm text-gray-700 dark:text-gray-200" data-testid="dhcp-reservations-compact">
        <span class="font-medium">{items.length}</span>
        {items.length === 1 ? " reservation" : " reservations"}
        {#if r0}
          <span class="font-mono text-gray-500 dark:text-gray-400"> · {r0.reserved_address}</span>
        {/if}
      </p>
    {/if}
  {/snippet}
</BaseDataTable>
