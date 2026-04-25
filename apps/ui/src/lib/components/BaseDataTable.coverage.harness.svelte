<script lang="ts">
  import BaseDataTable from "./BaseDataTable.svelte";
  import type { BaseDataTableColumn } from "./baseDataTable";
  import { defaultBaseDataTableSettings, mergeBaseDataTableSettings } from "./baseDataTable";

  let {
    variant,
  }: {
    variant: "compactSummary" | "fullSingle" | "cellSnippet";
  } = $props();

  const settings = mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
    allowPaging: false,
    allowModal: false,
    allowFilter: false,
    allowExportCsv: false,
    allowExportJson: false,
  });

  const items = [{ a: "row-a" }];
</script>

{#snippet snip(row: unknown)}
  <span data-testid="snip-cell">{(row as { a: string }).a}</span>
{/snippet}

{#if variant === "compactSummary"}
  <BaseDataTable
    title="Harness"
    {items}
    err={null}
    emptyText="empty"
    compact={true}
    columns={[{ header: "A", accessor: (r) => (r as { a: string }).a }]}
    rowKey={() => "1"}
    {settings}
  >
    {#snippet compactSummary()}
      <p data-testid="harness-compact-summary">summary</p>
    {/snippet}
  </BaseDataTable>
{:else if variant === "fullSingle"}
  <BaseDataTable
    title="Harness"
    {items}
    err={null}
    emptyText="empty"
    compact={false}
    columns={[{ header: "A", accessor: (r) => (r as { a: string }).a }]}
    rowKey={() => "1"}
    {settings}
  >
    {#snippet fullSingle()}
      <p data-testid="harness-full-single">single</p>
    {/snippet}
  </BaseDataTable>
{:else}
  <BaseDataTable
    title="Harness"
    {items}
    err={null}
    emptyText="empty"
    compact={false}
    columns={
      [
        {
          header: "A",
          accessor: (r) => (r as { a: string }).a,
          cell: snip,
        },
      ] satisfies BaseDataTableColumn[]
    }
    rowKey={() => "1"}
    {settings}
  />
{/if}
