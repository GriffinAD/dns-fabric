<script lang="ts">
  import type { Snippet } from "svelte";
  import Pencil from "lucide-svelte/icons/pencil";

  import type { DashboardTile } from "./types";

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

<div class="relative min-w-0" data-tile-id={tile.id}>
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
  {@render children()}
</div>
