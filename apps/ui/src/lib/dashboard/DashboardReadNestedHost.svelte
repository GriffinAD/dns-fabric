<script lang="ts">
  import type { Snippet } from "svelte";
  import DashboardReadNestedHost from "./DashboardReadNestedHost.svelte";
  import TileEditChrome from "./TileEditChrome.svelte";
  import {
    groupGridAreaStyle,
    groupGridColumnSpanStyle,
    groupOuterColSpan,
    packGroupChildrenRowWrapInOrder,
  } from "./gridPlacement";
  import { dedupeById } from "./layoutTree";
  import type { DashboardGroup, DashboardTile, GroupChild } from "./types";
  import { isDashboardGroupNode } from "./types";

  let {
    group,
    outerCols,
    editLayout = false,
    onEditTile,
    onDeleteGroupChildTile,
    tileContent,
  }: {
    group: DashboardGroup;
    outerCols: number;
    editLayout?: boolean;
    onEditTile?: (t: DashboardTile) => void;
    onDeleteGroupChildTile?: (groupId: string, tileId: string) => void;
    tileContent: Snippet<[DashboardTile, boolean]>;
  } = $props();

  const sorted = $derived(
    [...dedupeById(group.children)].sort(
      (a, b) =>
        (isDashboardGroupNode(a) ? (a.grid?.row ?? 0) : (a as DashboardTile).grid?.row ?? 0) -
          (isDashboardGroupNode(b) ? (b.grid?.row ?? 0) : (b as DashboardTile).grid?.row ?? 0) ||
        (isDashboardGroupNode(a) ? (a.grid?.col ?? 0) : (a as DashboardTile).grid?.col ?? 0) -
          (isDashboardGroupNode(b) ? (b.grid?.col ?? 0) : (b as DashboardTile).grid?.col ?? 0),
    ),
  );
</script>

<div
  class="grid h-full w-full min-h-0 min-w-0 auto-rows-[minmax(0,auto)] content-start gap-2 [box-sizing:border-box] [min-width:0] [place-self:stretch] [align-self:stretch] [overflow:visible]"
  style="grid-template-columns: repeat({outerCols}, minmax(0, 1fr));"
  data-dashboard-nested-read={group.id}
>
  {#each sorted as child (child.id)}
    {#if isDashboardGroupNode(child)}
      {@const Gc = groupOuterColSpan(child)}
      <div
        class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-gray-200/50 bg-white/20 p-1 dark:border-gray-600/40 dark:bg-gray-900/25"
        style={child.grid ? groupGridAreaStyle(child.grid, outerCols) : ""}
        data-dashboard-group={child.id}
      >
        {#if child.innerWrap === true}
          {@const tiles = dedupeById(child.children).filter(
            (c): c is DashboardTile => !isDashboardGroupNode(c),
          )}
          {@const packedInner = packGroupChildrenRowWrapInOrder(tiles, Gc)}
          <div
            class="grid min-h-0 w-full auto-rows-[minmax(0,auto)] content-start gap-1"
            style="grid-template-columns: repeat({Gc}, minmax(0, 1fr));"
          >
            {#each packedInner as tile (tile.id)}
              <div
                class="flex min-h-0 min-w-0 flex-col"
                style={tile.grid ? groupGridAreaStyle(tile.grid, Gc) : groupGridColumnSpanStyle(tile, Gc)}
                data-tile-id={tile.id}
              >
                <TileEditChrome
                  {tile}
                  onEdit={onEditTile}
                  onDelete={editLayout && onDeleteGroupChildTile
                    ? () => onDeleteGroupChildTile(child.id, tile.id)
                    : undefined}
                  showEditButton={editLayout}
                >
                  {#snippet children()}
                    {@render tileContent(tile, true)}
                  {/snippet}
                </TileEditChrome>
              </div>
            {/each}
          </div>
        {:else}
          <DashboardReadNestedHost
            group={child}
            outerCols={Gc}
            {editLayout}
            {onEditTile}
            {onDeleteGroupChildTile}
            {tileContent}
          />
        {/if}
      </div>
    {:else}
      {@const tile = child as DashboardTile}
      <div
        class="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col place-self-stretch"
        data-tile-id={tile.id}
        style={tile.grid ? groupGridAreaStyle(tile.grid, outerCols) : groupGridColumnSpanStyle(tile, outerCols)}
      >
        <TileEditChrome
          {tile}
          onEdit={onEditTile}
          onDelete={editLayout && onDeleteGroupChildTile
            ? () => onDeleteGroupChildTile(group.id, tile.id)
            : undefined}
          showEditButton={editLayout}
        >
          {#snippet children()}
            {@render tileContent(tile, true)}
          {/snippet}
        </TileEditChrome>
      </div>
    {/if}
  {/each}
</div>
