<script lang="ts">
  import BaseDataTableModal from "./BaseDataTableModal.svelte";
  import type { BaseDataTableColumn } from "./baseDataTable";

  let open = $state(true);
  let items = $state([
    { id: "1", name: "a" },
    { id: "2", name: "b" },
  ]);
  let commitCount = $state(0);

  const columns: BaseDataTableColumn[] = [
    {
      header: "Name",
      fieldKey: "name",
      accessor: (r) => (r as { name: string }).name,
      editable: true,
      editor: "text",
    },
  ];

  async function onCommit({ rowId, patch }: { rowId: string; patch: Record<string, unknown> }) {
    commitCount += 1;
    items = items.map((row) => (row.id === rowId ? { ...row, ...patch } : row));
  }
</script>

<BaseDataTableModal
  bind:open
  title="Harness"
  {items}
  {columns}
  rowKey={(r) => (r as { id: string }).id}
  allowEdit={true}
  {onCommit}
/>

<div data-testid="commit-count">{commitCount}</div>
