<script lang="ts">
  import BaseDataTable from "./BaseDataTable.svelte";
  import { defaultBaseDataTableSettings, mergeBaseDataTableSettings } from "./baseDataTable";

  let count = $state(15);
  const items = $derived(
    Array.from({ length: count }, (_, i) => ({ id: String(i), name: `u${i}`, role: "r" })),
  );

  const columns = [
    { id: "name", header: "Name", accessor: (r: unknown) => (r as { name: string }).name },
    { id: "role", header: "Role", accessor: (r: unknown) => (r as { role: string }).role },
  ];

  const settings = mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
    allowModal: false,
    allowFilter: false,
    allowExportCsv: false,
    allowExportJson: false,
    autoPageSize: false,
  });
</script>

<button type="button" data-testid="shrink-items" onclick={() => (count = 5)}>shrink</button>

<BaseDataTable
  title="Paged"
  {items}
  err={null}
  emptyText="e"
  compact={false}
  {columns}
  rowKey={(r) => (r as { id: string }).id}
  {settings}
/>
