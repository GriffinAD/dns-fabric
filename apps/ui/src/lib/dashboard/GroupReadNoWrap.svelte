<script lang="ts">
  import type { Snippet } from "svelte";
  import DashboardTileShell from "./DashboardTileShell.svelte";
  import { effectiveColSpan } from "./gridPlacement";
  import {
    DASHBOARD_STRIP_GAP_2_PX,
    flexStripDistributedWidth,
    stripScrollportObserve,
  } from "./stripWidth";
  import type { DashboardTile } from "./types";

  let {
    rowGroups,
    gCols,
    groupId,
    showPanelChrome,
    editLayout = false,
    onEditTile,
    tileContent,
  }: {
    rowGroups: DashboardTile[][];
    gCols: number;
    groupId: string;
    showPanelChrome: boolean;
    editLayout?: boolean;
    onEditTile?: (t: DashboardTile) => void;
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  let innerW = $state(0);

  /** Root-metric colSpan `T` → width `T/G` of the group; row may exceed one root-width “pack” and scroll. */
  function widthPx(t: DashboardTile, rowItemCount: number): string {
    const T = effectiveColSpan(t);
    const avail = flexStripDistributedWidth(innerW, rowItemCount, DASHBOARD_STRIP_GAP_2_PX);
    const px = (Math.max(0, avail) * T) / gCols;
    return `${px}px`;
  }

  /**
   * Measure the horizontal scrollport (not the outer column). After toggling edit ↔ dashboard
   * the subtree remounts; `clientWidth` can be 0 for a frame and `bind:clientWidth` may not
   * re-notify. ResizeObserver matches the editor no-wrap path and keeps tile widths and overflow
   * correct so the strip scrolls and inner controls do not wrap into a bogus narrow column.
   */
  function noWrapReadStripMeasure(el: HTMLDivElement) {
    return stripScrollportObserve(el, (w) => {
      innerW = w;
    });
  }
</script>

<div
  class="flex h-full min-h-0 w-full min-w-0 flex-col gap-2 [box-sizing:border-box] [place-self:stretch] [align-self:stretch]"
  data-dashboard-group-scroll={groupId}
>
  {#each rowGroups as rowTiles, rowI (rowTiles[0]?.grid?.row ?? rowI)}
    <div
      class="flex w-full min-h-0 min-w-0 max-w-full shrink-0 flex-nowrap items-stretch gap-2 overflow-x-auto overflow-y-hidden"
      use:noWrapReadStripMeasure
    >
      {#each rowTiles as tile (tile.id)}
        <div
          class="flex h-full min-h-0 max-w-none shrink-0 flex-col [min-width:2.5rem]"
          style:width={widthPx(tile, rowTiles.length)}
          data-in-row-panel={showPanelChrome ? "true" : undefined}
        >
          <DashboardTileShell {tile} {editLayout} {onEditTile}>
            {@render tileContent(tile)}
          </DashboardTileShell>
        </div>
      {/each}
    </div>
  {/each}
</div>
