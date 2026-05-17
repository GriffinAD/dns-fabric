<script lang="ts">
  import Select from "flowbite-svelte/Select.svelte";

  let {
    onExport,
    onImport,
  }: {
    onExport: () => void;
    onImport: () => void;
  } = $props();

  const items = [
    { value: "export", name: "Export layout" },
    { value: "import", name: "Import layout" },
  ];

  let value = $state("");

  function onLayoutMenuChange() {
    if (value === "export") onExport();
    else if (value === "import") onImport();
    value = "";
  }
</script>

<div class="min-w-0 sm:w-40" data-testid="layout-file-menu">
  <label
    for="layout-file-menu"
    class="mb-1 block text-xs font-medium whitespace-nowrap text-gray-700 dark:text-gray-300"
  >
    Layout
  </label>
  <Select
    id="layout-file-menu"
    class="w-full"
    size="sm"
    bind:value
    placeholder="Layout"
    items={items}
    onchange={onLayoutMenuChange}
  />
</div>
