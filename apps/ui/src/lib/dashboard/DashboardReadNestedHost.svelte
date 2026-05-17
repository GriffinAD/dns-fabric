<script lang="ts">
  /**
   * Read-mode nested groups: nowrap strip width/gap policy matches `GroupReadNoWrap` and editor
   * paths via `stripWidth.ts` — keep those modules aligned when changing flex gaps or scrollports.
   */
  import type { Snippet } from "svelte";
  import type { PluginEntry } from "../api/types";
  import TabGroupHost from "./groups/TabGroupHost.svelte";
  import DashboardReadNestedHost from "./DashboardReadNestedHost.svelte";
  import TileEditChrome from "./TileEditChrome.svelte";
  import {
    effectiveColSpan,
    groupGridAreaStyle,
    groupGridColumnSpanStyle,
    groupOuterColSpan,
    packGroupChildrenRowWrapInOrder,
  } from "./gridPlacement";
  import { dedupeById } from "./layoutTree";
  import {
    DASHBOARD_STRIP_GAP_2_PX,
    flexStripDistributedWidth,
    stripScrollportObserve,
  } from "./stripWidth";
  import type { DashboardGroup, DashboardTile, GroupChild } from "./types";
  import { isDashboardGroupNode } from "./types";

  let {
    group,
    outerCols,
    editLayout = false,
    onEditTile,
    onGroupChange,
    plugins = [] as PluginEntry[],
    tileContent,
  }: {
    group: DashboardGroup;
    outerCols: number;
    editLayout?: boolean;
    onEditTile?: (t: DashboardTile) => void;
    onGroupChange?: (g: DashboardGroup) => void;
    plugins?: PluginEntry[];
    tileContent: Snippet<[DashboardTile]>;
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

  const rowGroups = $derived.by(() => {
    const rows = new Map<number, GroupChild[]>();
    for (const c of sorted) {
      const row = isDashboardGroupNode(c) ? (c.grid?.row ?? 0) : (c.grid?.row ?? 0);
      const list = rows.get(row);
      if (list) list.push(c);
      else rows.set(row, [c]);
    }
    return [...rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, list]) =>
        [...list].sort(
          (a, b) =>
            (isDashboardGroupNode(a) ? (a.grid?.col ?? 0) : (a.grid?.col ?? 0)) -
            (isDashboardGroupNode(b) ? (b.grid?.col ?? 0) : (b.grid?.col ?? 0)),
        ),
      );
  });

  let innerW = $state(0);

  function widthPxForChild(c: GroupChild, rowItemCount: number): string {
    const span = isDashboardGroupNode(c) ? groupOuterColSpan(c) : effectiveColSpan(c);
    const avail = flexStripDistributedWidth(innerW, rowItemCount, DASHBOARD_STRIP_GAP_2_PX);
    const px = (Math.max(0, avail) * span) / Math.max(1, outerCols);
    return `${px}px`;
  }

  function noWrapReadStripMeasure(el: HTMLDivElement) {
    return stripScrollportObserve(el, (w) => {
      innerW = w;
    });
  }
</script>

<div
  class="flex h-full min-h-0 w-full min-w-0 flex-col gap-2 [box-sizing:border-box] [place-self:stretch] [align-self:stretch]"
  data-dashboard-nested-read={group.id}
>
  {#each rowGroups as row, rowI (rowI)}
    <div
      class="flex w-full min-h-0 min-w-0 max-w-full shrink-0 flex-nowrap items-stretch gap-2 overflow-x-auto overflow-y-hidden"
      use:noWrapReadStripMeasure
    >
      {#each row as child (child.id)}
    {#if isDashboardGroupNode(child)}
      {@const Gc = groupOuterColSpan(child)}
      {@const childShellBorder = child.showBorder !== false}
      <div
        class="flex min-h-0 max-w-none min-w-0 shrink-0 flex-col overflow-hidden rounded-md py-1 [min-width:2.5rem] {childShellBorder
          ? 'border border-gray-200/50 bg-white/20 dark:border-gray-600/40 dark:bg-gray-900/25'
          : 'border-0 bg-transparent'}"
        style:width={widthPxForChild(child, row.length)}
        data-dashboard-group={child.id}
      >
        {#if child.hostControl === "tab-control"}
          <TabGroupHost
            group={child}
            {editLayout}
            {onGroupChange}
            {plugins}
            {onEditTile}
            {tileContent}
          />
        {:else if child.innerWrap === true}
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
                data-in-row-panel={childShellBorder ? "true" : undefined}
              >
                <TileEditChrome
                  {tile}
                  onEdit={onEditTile}
                  showEditButton={editLayout}
                >
                  {#snippet children()}
                    {@render tileContent(tile)}
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
            {onGroupChange}
            {plugins}
            {tileContent}
          />
        {/if}
      </div>
    {:else}
      {@const tile = child as DashboardTile}
      {@const rowPanelChrome = group.showBorder !== false}
      <div
        class="flex h-full min-h-0 max-w-none min-w-0 shrink-0 flex-col [min-width:2.5rem]"
        data-tile-id={tile.id}
        data-in-row-panel={rowPanelChrome ? "true" : undefined}
        style:width={widthPxForChild(tile, row.length)}
      >
        <TileEditChrome
          {tile}
          onEdit={onEditTile}
          showEditButton={editLayout}
        >
          {#snippet children()}
            {@render tileContent(tile)}
          {/snippet}
        </TileEditChrome>
      </div>
    {/if}
      {/each}
    </div>
  {/each}
</div>
