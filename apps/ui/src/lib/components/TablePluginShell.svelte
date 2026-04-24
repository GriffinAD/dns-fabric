<script lang="ts">
  import Card from "flowbite-svelte/Card.svelte";
  import Table from "flowbite-svelte/Table.svelte";
  import TableBody from "flowbite-svelte/TableBody.svelte";
  import TableBodyCell from "flowbite-svelte/TableBodyCell.svelte";
  import TableBodyRow from "flowbite-svelte/TableBodyRow.svelte";
  import TableHead from "flowbite-svelte/TableHead.svelte";
  import TableHeadCell from "flowbite-svelte/TableHeadCell.svelte";
  import type { Snippet } from "svelte";

  import type { TableShellColumn } from "./tablePluginShell";

  let {
    title,
    items,
    err,
    emptyText,
    compact,
    columns,
    rowKey,
    compactSummary,
    /** When not compact and exactly one row, render instead of a one-row table. */
    fullSingle,
    maxHeightClass = "max-h-[480px]",
  }: {
    title: string;
    items: unknown[];
    err: string | null;
    emptyText: string;
    compact: boolean;
    columns: TableShellColumn[];
    rowKey: (row: unknown) => string;
    /** Render compact body; use parent closure over `items`. */
    compactSummary?: Snippet;
    fullSingle?: Snippet;
    maxHeightClass?: string;
  } = $props();

  const visibleColumns = $derived(columns.filter((c) => !compact || !c.hideWhenCompact));
</script>

<Card
  size="xl"
  class="box-border !max-w-full w-full min-w-0 {maxHeightClass} flex-1 min-h-0 flex-col overflow-auto"
>
  {#snippet children()}
    <div class="p-4">
      <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      {#if err}
        <p class="text-sm text-red-600 dark:text-red-400" role="alert">{err}</p>
      {:else if items.length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
      {:else if !compact && items.length === 1 && fullSingle}
        {@render fullSingle()}
      {:else if compact && compactSummary}
        {@render compactSummary()}
      {:else}
        <Table hoverable={true}>
          <TableHead>
            {#each visibleColumns as col (col.header)}
              <TableHeadCell>{col.header}</TableHeadCell>
            {/each}
          </TableHead>
          <TableBody>
            {#each items as row (rowKey(row))}
              <TableBodyRow>
                {#each visibleColumns as col (col.header)}
                  <TableBodyCell class={col.cellClass ?? ""}>{col.accessor(row)}</TableBodyCell>
                {/each}
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </div>
  {/snippet}
</Card>
