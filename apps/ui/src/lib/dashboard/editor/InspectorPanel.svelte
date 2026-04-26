<script lang="ts">
  import { findTileInLayout, iterateTilesInLayout } from "../layoutTree";
  import type { DashboardLayoutV3 } from "../types";
  import { editorSelection } from "./editorState";

  let { layout }: { layout: DashboardLayoutV3 } = $props();

  const tileCount = $derived([...iterateTilesInLayout(layout.items)].length);

  /** Where the selected tile lives (for inspector only; not painted on the dashboard in read mode). */
  const tilePlacementParentLabel = $derived.by((): string | null => {
    const s = $editorSelection;
    if (s == null || s.kind !== "tile") return null;
    const f = findTileInLayout(layout.items, s.id);
    if (f == null) return null;
    if (f.inGroup == null) return "Dashboard (root grid)";
    return `Container ${f.inGroup.id}`;
  });
</script>

<aside
  class="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
  data-testid="dashboard-inspector"
  aria-label="Dashboard inspector"
>
  <p class="font-medium text-gray-800 dark:text-gray-100">Inspector</p>
  <p class="mt-2 text-gray-600 dark:text-gray-400">Tiles in layout: {tileCount}</p>
  {#if $editorSelection}
    <p class="mt-2 text-gray-700 dark:text-gray-300" data-testid="inspector-selection">
      Selected: {$editorSelection.kind}
      <span class="font-mono">{$editorSelection.id}</span>
      — {$editorSelection.label}
    </p>
    {#if $editorSelection.kind === "tile" && tilePlacementParentLabel}
      <p class="mt-1 text-gray-600 dark:text-gray-400" data-testid="inspector-tile-parent">
        Placement: {tilePlacementParentLabel}
      </p>
    {/if}
  {:else}
    <p class="mt-2 text-gray-500 dark:text-gray-400">Select a tile or container in the grid to see details.</p>
  {/if}
</aside>
