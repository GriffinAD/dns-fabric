<script lang="ts">
  import type { Snippet } from "svelte";
  import Pencil from "lucide-svelte/icons/pencil";
  import Trash2 from "lucide-svelte/icons/trash-2";

  import type { DashboardTile } from "./types";

  let {
    tile,
    onEdit,
    onDelete,
    showEditButton = false,
    children,
  }: {
    tile: DashboardTile;
    onEdit?: (tile: DashboardTile) => void;
    /** Remove this tile; only in edit mode when provided. */
    onDelete?: () => void;
    /** Pencil control; only while “Edit layout” is on. */
    showEditButton?: boolean;
    children: Snippet;
  } = $props();
</script>

<div class="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col items-stretch">
  {#if onEdit && showEditButton}
    <button
      type="button"
      class="absolute right-1 top-1 z-10 rounded-md border border-gray-200 bg-white/95 p-1.5 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-200 dark:hover:bg-gray-700"
      data-testid="tile-edit-button"
      aria-label="Edit tile settings"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => onEdit(tile)}
    >
      <Pencil class="h-4 w-4" aria-hidden="true" />
    </button>
  {/if}
  {#if onDelete && showEditButton}
    <button
      type="button"
      class="absolute right-10 top-1 z-10 rounded-md border border-red-200 bg-white/95 p-1.5 text-red-600 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-gray-800/95 dark:text-red-400 dark:hover:bg-red-950/50"
      data-testid="tile-delete-button"
      aria-label="Remove tile from dashboard"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => onDelete()}
    >
      <Trash2 class="h-4 w-4" aria-hidden="true" />
    </button>
  {/if}
  {@render children()}
</div>

<!-- Flowbite Card ships max-w-sm on the base slot; class merge can leave both max-w-sm and
     max-w-none, and margin:auto variants can keep tiles visually inset. This :global is the
     single place we force true full-width in the grid. -->
<style>
  :global([data-testid="editor-tile"] [data-scope="card"][data-part="base"]),
  :global([data-dashboard-tile-grid] > * [data-scope="card"][data-part="base"]),
  :global([data-dashboard-tile-grid] [data-in-row-panel] [data-scope="card"][data-part="base"]) {
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    align-self: stretch;
    min-width: 0;
    width: 100% !important;
    max-width: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    margin-inline: 0 !important;
  }

  /* Table wraps content in a full-width scroller; keep it as wide as the card, not max-w-sm. */
  :global([data-testid="editor-tile"] [data-scope="table"][data-part="wrapper"]),
  :global([data-dashboard-tile-grid] > * [data-scope="table"][data-part="wrapper"]) {
    display: block;
    width: 100% !important;
    max-width: none !important;
  }
</style>
