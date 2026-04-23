<script lang="ts">
  import {
    clampGridColSpan,
    clampGridRowSpan,
    clampGroupChildStripOriginCol,
    GRID_COLUMNS,
    GROUP_CHILD_INNER_STRIP_MAX_EXTENT,
    groupInnerWidthInPhysicalTracks,
  } from "./gridPlacement";
  import { PARENT_ID_DASHBOARD } from "./layoutTree";
  import type { DashboardTile } from "./types";

  let {
    draft = $bindable<DashboardTile>(),
    selectedParentId = $bindable<string>(),
    gridMode,
    parentOptions,
    containerWidthColumns = null as number | null,
    reClampGridForParent,
  }: {
    draft: DashboardTile;
    selectedParentId: string;
    gridMode: "root" | "wrap" | "strip";
    parentOptions: { value: string; label: string }[];
    containerWidthColumns?: number | null;
    reClampGridForParent: (d: DashboardTile, parentId: string) => DashboardTile;
  } = $props();

  const colInputMax = $derived(
    gridMode === "strip"
      ? Math.max(0, GROUP_CHILD_INNER_STRIP_MAX_EXTENT - draft.grid!.colSpan)
      : GRID_COLUMNS - draft.grid!.colSpan,
  );
</script>

<div class="grid grid-cols-2 gap-3">
  <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
    <span>Width (columns)</span>
    <input
      type="number"
      min="1"
      max="12"
      class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      value={draft.grid!.colSpan}
      oninput={(e) => {
        const n = Number((e.currentTarget as HTMLInputElement).value);
        const cs = clampGridColSpan(n);
        const col =
          gridMode === "strip"
            ? clampGroupChildStripOriginCol(draft.grid!.col, cs)
            : Math.min(draft.grid!.col, GRID_COLUMNS - cs);
        draft = {
          ...draft,
          grid: { ...draft.grid!, colSpan: cs, col },
        };
      }}
    />
    {#if selectedParentId !== PARENT_ID_DASHBOARD && containerWidthColumns != null}
      <span class="text-[11px] font-normal text-gray-500 dark:text-gray-500">
        Same 1–12 column units as the main dashboard. Each unit is the same width as on the root grid. In a
        {containerWidthColumns}-wide row, a width of {draft.grid!.colSpan} uses
        {groupInnerWidthInPhysicalTracks(draft.grid!.colSpan, containerWidthColumns)} of
        {containerWidthColumns} physical tracks (capped to the container).
      </span>
    {/if}
  </label>
  <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
    <span>Height (rows)</span>
    <input
      type="number"
      min="1"
      max="12"
      class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      value={draft.grid!.rowSpan}
      oninput={(e) => {
        const n = Number((e.currentTarget as HTMLInputElement).value);
        draft = {
          ...draft,
          grid: { ...draft.grid!, rowSpan: clampGridRowSpan(n) },
        };
      }}
    />
  </label>
  <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
    <span
      >{gridMode === "strip" && selectedParentId !== PARENT_ID_DASHBOARD
        ? "Start column (0+)"
        : "Column (0–11)"}</span
    >
    <input
      type="number"
      min="0"
      max={colInputMax}
      class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      value={draft.grid!.col}
      oninput={(e) => {
        const n = Number((e.currentTarget as HTMLInputElement).value);
        const cs = draft.grid!.colSpan;
        const col =
          gridMode === "strip"
            ? clampGroupChildStripOriginCol(Math.floor(n), cs)
            : Math.max(0, Math.min(GRID_COLUMNS - cs, Math.floor(n)));
        draft = {
          ...draft,
          grid: { ...draft.grid!, col },
        };
      }}
    />
    {#if gridMode === "strip" && selectedParentId !== PARENT_ID_DASHBOARD}
      <span class="text-[11px] font-normal text-gray-500 dark:text-gray-500">
        Auto wrap is off: one row can span more than 12 width-units, so the start column may be greater than 11.
      </span>
    {/if}
  </label>
  <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
    <span>Row (from top)</span>
    <input
      type="number"
      min="0"
      class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      value={draft.grid!.row}
      oninput={(e) => {
        const n = Number((e.currentTarget as HTMLInputElement).value);
        const row = Math.max(0, Math.floor(n));
        draft = {
          ...draft,
          grid: { ...draft.grid!, row },
        };
      }}
    />
  </label>
</div>

<label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
  <span>Parent</span>
  <select
    class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
    data-testid="tile-settings-parent"
    value={selectedParentId}
    onchange={(e) => {
      const v = (e.currentTarget as HTMLSelectElement).value;
      selectedParentId = v;
      draft = reClampGridForParent(draft, v);
    }}
  >
    {#each parentOptions as o (o.value)}
      <option value={o.value}>{o.label}</option>
    {/each}
  </select>
  <span class="text-[11px] leading-snug text-gray-500 dark:text-gray-500">
    {PARENT_ID_DASHBOARD === selectedParentId
      ? "Tile sits on the main dashboard grid."
      : "Tile sits inside the selected container’s inner grid."}
  </span>
</label>
