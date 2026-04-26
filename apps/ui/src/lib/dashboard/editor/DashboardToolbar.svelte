<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";

  import type { LayoutStore } from "../layoutStore";

  let {
    ls,
    editLayout,
  }: {
    ls: LayoutStore;
    editLayout: boolean;
  } = $props();
</script>

{#if editLayout}
  <div
    class="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
    data-testid="dashboard-editor-toolbar"
    aria-label="Layout undo and redo"
  >
    <p class="font-medium text-gray-800 dark:text-gray-100">History</p>
    <div class="flex flex-wrap gap-2">
      <Button type="button" size="xs" color="alternative" data-testid="toolbar-undo" onclick={() => ls.undo()}>
        Undo
      </Button>
      <Button type="button" size="xs" color="alternative" data-testid="toolbar-redo" onclick={() => ls.redo()}>
        Redo
      </Button>
    </div>
  </div>
{/if}
