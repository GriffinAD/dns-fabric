<script lang="ts">
  import type { Snippet } from "svelte";
  import Pencil from "lucide-svelte/icons/pencil";

  import { EDITOR_PLUGIN_HOVER_VISIBLE, EDITOR_PLUGIN_SURFACE_CLASS } from "../interactions/editorChrome";
  import type { DashboardTile } from "../types";

  let {
    tile,
    onEdit,
    showEditButton = false,
    children,
  }: {
    tile: DashboardTile;
    onEdit?: (tile: DashboardTile) => void;
    /** Pencil control; only while “Edit layout” is on. */
    showEditButton?: boolean;
    children: Snippet;
  } = $props();
</script>

<div
  class="{EDITOR_PLUGIN_SURFACE_CLASS} relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col items-stretch"
>
  {#if onEdit && showEditButton}
    <button
      type="button"
      class="{EDITOR_PLUGIN_HOVER_VISIBLE} editor-chrome-edit editor-chrome-top absolute right-2 z-50 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-slate-200/80 bg-slate-50/95 text-emerald-600 shadow-sm backdrop-blur-[2px] hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-500/60 dark:border-gray-600 dark:bg-gray-900/90 dark:text-emerald-300 dark:hover:bg-gray-800"
      data-testid="tile-edit-button"
      aria-label="Edit tile settings"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => onEdit(tile)}
    >
      <Pencil class="h-4 w-4" aria-hidden="true" />
    </button>
  {/if}
  {@render children()}
</div>

<!-- Flowbite Card ships max-w-sm on the base slot; class merge can leave both max-w-sm and
     max-w-none, and margin:auto variants can keep tiles visually inset. This :global is the
     single place we force true full-width in the grid. -->
<style>
  :global([data-dashboard-editor="tile-row"] [data-scope="card"][data-part="base"]),
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
  :global([data-dashboard-editor="tile-row"] [data-scope="table"][data-part="wrapper"]),
  :global([data-testid="editor-tile"] [data-scope="table"][data-part="wrapper"]),
  :global([data-dashboard-tile-grid] > * [data-scope="table"][data-part="wrapper"]) {
    display: block;
    width: 100% !important;
    max-width: none !important;
  }
</style>
