<script lang="ts">
  import type { DragDropState } from "@thisux/sveltednd";
  import { dndState } from "@thisux/sveltednd";
  import type { Snippet } from "svelte";
  import { GRID_COLUMNS, rootEditGridColumnCount } from "../grid/gridPlacement";
  import {
    type DashboardDndListItem,
    isDndCellGroup,
  } from "../grid/groupDndFinalize";
  import {
    EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX,
    EDITOR_CHROME_TOP_OFFSET_PX,
  } from "../interactions/editorChrome";
  import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
  import { parseDragPayload } from "../interactions/dashboardSveltedndTypes";
  import EditorDropZone from "../editor/EditorDropZone.svelte";
  import EditorRootGroupShell from "../editor/EditorRootGroupShell.svelte";
  import EditorRootTileCell from "../editor/EditorRootTileCell.svelte";
  import type { PluginEntry } from "../../api/types";
  import type { DashboardGroup, DashboardTile, RootLayoutItem } from "../types";

  let {
    dndRoot,
    dndByGroup,
    rootPackedById,
    editorPointerDndActive,
    noWrapEditPortW,
    noWrapStripPortMeasure,
    chromeDragSm,
    chromeEditSm,
    onLayoutDrop,
    onDragOverLayout,
    onDragEndLayout,
    editorTileInPlay,
    editorGroupInPlay,
    onAddTileToGroup,
    onAddGroupToGroup,
    onEditGroup,
    onTabGroupChange,
    plugins = [] as PluginEntry[],
    editLayout,
    onEditTile,
    onItemColSpanChange,
    getSubDndList,
    tileContent,
  }: {
    dndRoot: DashboardDndListItem[];
    dndByGroup: Record<string, DashboardDndListItem[]>;
    rootPackedById: Map<string, RootLayoutItem>;
    editorPointerDndActive: boolean;
    noWrapEditPortW: Record<string, number>;
    noWrapStripPortMeasure: (el: HTMLDivElement, gid: string) => { destroy: () => void };
    chromeDragSm: string;
    chromeEditSm: string;
    onLayoutDrop: (state: DragDropState<DashboardDragPayload>) => void;
    onDragOverLayout: (state: DragDropState<DashboardDragPayload>) => void;
    onDragEndLayout: (state: DragDropState<DashboardDragPayload>) => void;
    editorTileInPlay: (id: string) => boolean;
    editorGroupInPlay: (id: string) => boolean;
    onAddTileToGroup?: (groupId: string, pluginId: string) => void;
    onAddGroupToGroup?: (parentGroupId: string) => void;
    onEditGroup?: (g: DashboardGroup) => void;
    onTabGroupChange?: (g: DashboardGroup) => void;
    plugins?: PluginEntry[];
    editLayout: boolean;
    onEditTile?: (tile: DashboardTile) => void;
    onItemColSpanChange?: (
      itemId: string,
      colSpan: number,
      phase: "preview" | "commit",
      groupId?: string,
    ) => void;
    getSubDndList: (group: DashboardGroup) => DashboardDndListItem[];
    tileContent: Snippet<[DashboardTile]>;
  } = $props();

  const dropCb = $derived.by(() => ({
    onDrop: onLayoutDrop,
    onDragOver: onDragOverLayout,
    onDragEnd: onDragEndLayout,
  }));

  const activeDragPayload = $derived.by((): DashboardDragPayload | null => {
    if (!editorPointerDndActive) return null;
    return parseDragPayload(dndState.draggedItem) ?? (dndState.draggedItem as DashboardDragPayload);
  });

  function dndRootRowForDrag(drag: DashboardDragPayload): DashboardDndListItem | undefined {
    if (drag.k !== "cr") return undefined;
    return dndRoot.find((d) => d.id === drag.i);
  }

  /** True when the pointer drag is a root-level **container** row (blue grip), not a dashboard tile. */
  function draggingRootContainer(drag: DashboardDragPayload): boolean {
    const row = dndRootRowForDrag(drag);
    return row != null && isDndCellGroup(row.item);
  }

  /** True when the pointer drag is a root-level **plugin tile** (green grip on the canvas). */
  function draggingRootPluginTile(drag: DashboardDragPayload): boolean {
    const row = dndRootRowForDrag(drag);
    return row != null && !isDndCellGroup(row.item);
  }

  /** Inner container canvas/gap/append — palette, in-panel tiles, or a root tile entering a panel. */
  function groupInnerSurfaceDragActive(): boolean {
    const drag = activeDragPayload;
    if (!editorPointerDndActive || !drag) return false;
    if (drag.k === "cg" || drag.k === "pp" || drag.k === "pg") return true;
    return drag.k === "cr" && draggingRootPluginTile(drag);
  }

  /** Root-grid overlay on a panel — only while repositioning that panel on the canvas. */
  function rootGroupGridDropActive(groupId: string): boolean {
    const drag = activeDragPayload;
    if (!editorPointerDndActive || !drag || drag.k !== "cr") return false;
    if (!draggingRootContainer(drag)) return false;
    return drag.i !== groupId;
  }

  /** Root tile hit targets — reorder on canvas or promote a panel child onto the root grid. */
  function rootPluginTileHitActive(): boolean {
    const drag = activeDragPayload;
    if (!editorPointerDndActive || !drag) return false;
    if (drag.k === "cg" || drag.k === "pp" || drag.k === "pg") return true;
    return drag.k === "cr";
  }

  type RootRowEndDropSlot = { key: string; row: number; startCol: number; span: number; targetId: string };
  type RootRowGapDropSlot = { key: string; row: number; startCol: number; span: number; afterId: string };

  const rootAppendGridRow = $derived.by((): number => {
    let maxEnd = 0;
    for (const d of dndRoot) {
      const grid = rootPackedById.get(d.id)?.grid;
      if (!grid) continue;
      maxEnd = Math.max(maxEnd, grid.row + (grid.rowSpan ?? 1));
    }
    return maxEnd + 1;
  });

  const rootRowGapDropSlots = $derived.by((): RootRowGapDropSlot[] => {
    const byRow = new Map<number, Array<{ id: string; col: number; end: number }>>();
    for (const d of dndRoot) {
      const grid = rootPackedById.get(d.id)?.grid;
      if (!grid || grid.rowSpan !== 1) continue;
      const row = grid.row;
      const list = byRow.get(row) ?? [];
      list.push({ id: d.id, col: grid.col, end: grid.col + grid.colSpan });
      byRow.set(row, list);
    }
    const out: RootRowGapDropSlot[] = [];
    for (const [row, tiles] of byRow) {
      tiles.sort((a, b) => a.col - b.col);
      for (let i = 0; i < tiles.length - 1; i++) {
        const a = tiles[i]!;
        const b = tiles[i + 1]!;
        if (b.col > a.end) {
          out.push({
            key: `gap:${a.id}:${b.id}`,
            row,
            startCol: a.end,
            span: b.col - a.end,
            afterId: a.id,
          });
        }
      }
    }
    return out;
  });

  const rootPackedItems = $derived(
    dndRoot
      .map((d) => rootPackedById.get(d.id))
      .filter((p): p is RootLayoutItem => p != null),
  );

  const rootGridColumnCount = $derived(
    rootEditGridColumnCount(rootPackedItems, { dragging: editorPointerDndActive }),
  );

  const rootGridMinWidthPercent = $derived(
    `${(rootGridColumnCount / GRID_COLUMNS) * 100}%`,
  );

  const rootRowEndDropSlots = $derived.by((): RootRowEndDropSlot[] => {
    const cols = rootGridColumnCount;
    const byRow = new Map<number, { endExclusive: number; targetId: string }>();
    for (const d of dndRoot) {
      const placed = rootPackedById.get(d.id);
      const grid = placed?.grid;
      if (!grid) continue;
      const row = Math.max(0, grid.row);
      const endExclusive = Math.max(1, grid.col + grid.colSpan);
      const prev = byRow.get(row);
      if (!prev || endExclusive > prev.endExclusive) {
        byRow.set(row, { endExclusive, targetId: d.id });
      }
    }
    return [...byRow.entries()]
      .filter(([, v]) => v.endExclusive < cols)
      .map(([row, v]) => ({
        key: `r:${row}:end:${v.targetId}`,
        row,
        startCol: v.endExclusive,
        span: cols - v.endExclusive,
        targetId: v.targetId,
      }));
  });
</script>

<!-- Root edit chrome + 20-column drop zone; state lives in DashboardHost. -->
<div
  class="relative min-h-[120px] max-w-full overflow-x-auto overflow-y-visible rounded-lg border-2 border-dashed border-slate-300/95 p-1 dark:border-gray-600"
  data-dashboard-editor="grid-chrome"
  data-testid="editor-grid-chrome"
  data-editor-pointer-dnd={editorPointerDndActive ? "true" : "false"}
  data-editor-invalid-drop={dndState.invalidDrop ? "true" : "false"}
  role="region"
  aria-label="Drop plugins or a new container onto the grid"
  style="--editor-chrome-button-offset: {EDITOR_CHROME_BUTTON_LATERAL_OFFSET_PX}px; --editor-chrome-top: {EDITOR_CHROME_TOP_OFFSET_PX}px;"
>
  <EditorDropZone
    {dndRoot}
    {dropCb}
    {rootGridColumnCount}
    {rootGridMinWidthPercent}
    {rootRowGapDropSlots}
    {rootRowEndDropSlots}
    {editorPointerDndActive}
    {rootAppendGridRow}
  >
    {#snippet children()}
      {#each dndRoot as d (d.id)}
        {@const placed = rootPackedById.get(d.id)}
        {@const g = isDndCellGroup(d.item) ? d.item : null}
        {@const cv = !isDndCellGroup(d.item) ? (d.item as DashboardTile) : null}
        {#if g}
          <EditorRootGroupShell
            item={d}
            group={g}
            {placed}
            {dndByGroup}
            {dropCb}
            {chromeDragSm}
            {chromeEditSm}
            {editorTileInPlay}
            {editorGroupInPlay}
            {onEditGroup}
            onGroupChange={onTabGroupChange}
            {plugins}
            {editLayout}
            {onEditTile}
            {onItemColSpanChange}
            {getSubDndList}
            {noWrapEditPortW}
            {noWrapStripPortMeasure}
            {rootGroupGridDropActive}
            {groupInnerSurfaceDragActive}
            {tileContent}
          />
        {:else if cv}
          <EditorRootTileCell
            item={d}
            tile={cv}
            {placed}
            {dropCb}
            {chromeDragSm}
            {chromeEditSm}
            {editorTileInPlay}
            {rootPluginTileHitActive}
            {editLayout}
            {onEditTile}
            {onItemColSpanChange}
            {tileContent}
          />
        {/if}
      {/each}
    {/snippet}
  </EditorDropZone>
</div>
