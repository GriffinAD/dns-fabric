<script lang="ts">
  import type { Snippet } from "svelte";
  import TileEditChrome from "./TileEditChrome.svelte";
  import { effectiveColSpan } from "./gridPlacement";
  import { stripScrollportObserve } from "./stripWidth";
  import type { DashboardTile } from "./types";

  let {
    rowGroups,
    gCols,
    groupId,
    showPanelChrome,
    editLayout = false,
    onEditTile,
    onDeleteGroupChildTile,
    tileContent,
  }: {
    rowGroups: DashboardTile[][];
    gCols: number;
    groupId: string;
    showPanelChrome: boolean;
    editLayout?: boolean;
    onEditTile?: (t: DashboardTile) => void;
    onDeleteGroupChildTile?: (groupId: string, tileId: string) => void;
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  let innerW = $state(0);

  /** 12-metric colSpan `T` → width `T/G` of the group; row may exceed one “12-pack” and scroll. */
  function widthPx(t: DashboardTile): string {
    const T = effectiveColSpan(t);
    const px = (Math.max(0, innerW) * T) / gCols;
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
      class="flex w-full min-h-0 min-w-0 max-w-full shrink-0 flex-nowrap items-stretch gap-2 overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable_both-edges]"
      use:noWrapReadStripMeasure
    >
      {#each rowTiles as tile (tile.id)}
        <div
          class="flex h-full min-h-0 max-w-none shrink-0 flex-col [min-width:2.5rem]"
          style:width={widthPx(tile)}
          data-tile-id={tile.id}
          data-in-row-panel={showPanelChrome ? "true" : undefined}
        >
          <TileEditChrome
            {tile}
            onEdit={onEditTile}
            onDelete={editLayout && onDeleteGroupChildTile
              ? () => onDeleteGroupChildTile(groupId, tile.id)
              : undefined}
            showEditButton={editLayout}
          >
            {#snippet children()}
              {@render tileContent(tile)}
            {/snippet}
          </TileEditChrome>
        </div>
      {/each}
    </div>
  {/each}
</div>
