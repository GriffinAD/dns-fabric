<script lang="ts">
  import type { Snippet } from "svelte";

  import BaseDataTable from "./BaseDataTable.svelte";
  import type { BaseDataTableColumn } from "./baseDataTable";
  import { tableShellLegacySettings } from "./baseDataTable";

  let {
    title,
    items,
    err,
    emptyText,
    compact,
    columns,
    rowKey,
    compactSummary,
    fullSingle,
    maxHeightClass = "max-h-[480px]",
  }: {
    title: string;
    items: unknown[];
    err: string | null;
    emptyText: string;
    compact: boolean;
    columns: BaseDataTableColumn[];
    rowKey: (row: unknown) => string;
    compactSummary?: Snippet;
    fullSingle?: Snippet;
    maxHeightClass?: string;
  } = $props();
</script>

<BaseDataTable
  {title}
  {items}
  {err}
  {emptyText}
  {compact}
  {columns}
  {rowKey}
  {compactSummary}
  {fullSingle}
  {maxHeightClass}
  settings={tableShellLegacySettings}
/>
