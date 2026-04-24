<script lang="ts">
  import { onMount } from "svelte";

  import type { DhcpClient, DhcpPool, DhcpReservation } from "../api/types";
  import TablePluginShell from "../components/TablePluginShell.svelte";
  import type { TableShellColumn } from "../components/tablePluginShell";
  import { DataGateway } from "../dataGateway";
  import type { DashboardTile } from "../dashboard/types";

  /** DHCP list tiles share one shell; `kind` selects columns and fetcher (no dashboard `pluginId` branches). */
  let {
    gateway,
    tile,
    kind,
  }: {
    gateway: DataGateway;
    tile: DashboardTile;
    kind: "pools" | "clients" | "reservations";
  } = $props();

  let items = $state<unknown[]>([]);
  let err = $state<string | null>(null);

  const compact = $derived(tile.displayMode === "compact");

  const title = $derived(
    kind === "pools" ? "DHCP pools" : kind === "clients" ? "DHCP clients" : "Static reservations",
  );

  const emptyText = $derived(
    kind === "pools" ? "No pools." : kind === "clients" ? "No active clients." : "No reservations.",
  );

  const columns = $derived.by((): TableShellColumn[] => {
    if (kind === "pools") {
      return [
        { header: "Subnet", accessor: (p) => (p as DhcpPool).subnet_cidr },
        { header: "Range", accessor: (p) => `${(p as DhcpPool).range_start} – ${(p as DhcpPool).range_end}` },
        { header: "Domain", accessor: (p) => (p as DhcpPool).dns_domain ?? "—", hideWhenCompact: true },
      ];
    }
    if (kind === "clients") {
      return [
        {
          header: "IP",
          accessor: (c) => (c as DhcpClient).assigned_address,
          cellClass: "font-mono text-xs",
        },
        { header: "Host", accessor: (c) => (c as DhcpClient).hostname ?? "—" },
        {
          header: "MAC",
          accessor: (c) => (c as DhcpClient).hardware_address,
          cellClass: "font-mono text-xs",
        },
        {
          header: "Vendor",
          accessor: (c) => (c as DhcpClient).vendor_name ?? "—",
          hideWhenCompact: true,
        },
        {
          header: "Lease ends",
          accessor: (c) => (c as DhcpClient).lease_expires_at ?? "—",
          hideWhenCompact: true,
          cellClass: "font-mono text-xs",
        },
      ];
    }
    return [
      {
        header: "Category",
        accessor: (r) => (r as DhcpReservation).category ?? "STATIC",
        hideWhenCompact: true,
      },
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
      {
        header: "Subnet",
        accessor: (r) => (r as DhcpReservation).subnet_cidr ?? "—",
        hideWhenCompact: true,
      },
    ];
  });

  onMount(() => {
    const req =
      kind === "pools"
        ? gateway.listDhcpPools()
        : kind === "clients"
          ? gateway.listDhcpClients()
          : gateway.listDhcpReservations();
    void req
      .then((r) => {
        items = r.items;
      })
      .catch((e: unknown) => {
        err = e instanceof Error ? e.message : String(e);
      });
  });
</script>

{#if kind === "pools"}
  <TablePluginShell
    {title}
    {items}
    {err}
    {emptyText}
    {compact}
    {columns}
    rowKey={(p) => (p as DhcpPool).id}
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
  </TablePluginShell>
{:else if kind === "clients"}
  <TablePluginShell
    {title}
    {items}
    {err}
    {emptyText}
    {compact}
    {columns}
    rowKey={(c) => (c as DhcpClient).id}
  />
{:else}
  <TablePluginShell
    {title}
    {items}
    {err}
    {emptyText}
    {compact}
    {columns}
    rowKey={(r) => (r as DhcpReservation).id}
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
  </TablePluginShell>
{/if}
