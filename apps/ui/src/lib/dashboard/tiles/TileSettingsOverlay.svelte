<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";

  import type { HostControl, PluginEntry } from "../../types";
  import {
    clampGridColSpan,
    clampGridRowSpan,
    clampGroupChildGridPlacement,
    clampTileGridPlacement,
    tileColSpan,
  } from "../grid/gridPlacement";
  import { resolvePluginTileSettings } from "../../plugins/core/registry";
  import { PARENT_ID_DASHBOARD } from "../layout/layoutTree";
  import TileGenericFields from "./TileGenericFields.svelte";
  import TilePlacementForm from "./TilePlacementForm.svelte";
  import type { DashboardTile } from "../../types";

  let {
    tile,
    plugins,
    parentOptions,
    initialParentId,
    onClose,
    onSave,
    onDelete,
    containerWidthColumns = null as number | null,
    containerGroups = [] as { id: string; innerWrap: boolean }[],
  }: {
    tile: DashboardTile;
    plugins: PluginEntry[];
    parentOptions: { value: string; label: string }[];
    initialParentId: string;
    onClose: () => void;
    onSave: (next: DashboardTile, parentId: string) => void;
    /** Remove this tile from the layout (tile settings only; no quick-delete on the card). */
    onDelete?: () => void;
    containerWidthColumns?: number | null;
    containerGroups?: { id: string; innerWrap: boolean }[];
  } = $props();

  function layoutModeForParent(parentId: string): "root" | "wrap" | "strip" {
    if (parentId === PARENT_ID_DASHBOARD) return "root";
    const meta = containerGroups.find((c) => c.id === parentId);
    if (meta == null) return "wrap";
    return meta.innerWrap ? "wrap" : "strip";
  }

  function cloneDraft(from: DashboardTile, parentIdForClamp: string): DashboardTile {
    const g0 = from.grid;
    const cs0 = g0 != null ? clampGridColSpan(g0.colSpan) : tileColSpan(from);
    const rs0 = g0 != null ? clampGridRowSpan(g0.rowSpan) : 1;
    const prelim: DashboardTile = {
      ...from,
      grid: { col: g0?.col ?? 0, row: g0?.row ?? 0, colSpan: cs0, rowSpan: rs0 },
      options: from.options ? { ...from.options } : undefined,
    };
    const mode = layoutModeForParent(parentIdForClamp);
    const g =
      mode === "strip" ? clampGroupChildGridPlacement(prelim, false) : clampTileGridPlacement(prelim);
    return { ...from, grid: g, options: from.options ? { ...from.options } : undefined };
  }

  function reClampGridForParent(d: DashboardTile, parentId: string): DashboardTile {
    if (d.grid == null) return d;
    const mode = layoutModeForParent(parentId);
    const g = mode === "strip" ? clampGroupChildGridPlacement(d, false) : clampTileGridPlacement(d);
    return { ...d, grid: g };
  }

  // svelte-ignore state_referenced_locally
  let draft = $state(cloneDraft(tile, initialParentId));
  // svelte-ignore state_referenced_locally
  let selectedParentId = $state(initialParentId);

  $effect(() => {
    draft = cloneDraft(tile, initialParentId);
    selectedParentId = initialParentId;
  });

  function manifestFor(pluginId: string): PluginEntry | undefined {
    return plugins.find((p) => p.id === pluginId);
  }

  function hostChoices(manifest: PluginEntry | undefined): HostControl[] {
    const list = manifest?.ui_dashboard?.allowed_host_controls;
    return list?.length ? list : ["single-panel"];
  }

  function save() {
    if (!draft) return;
    const g = draft.grid!;
    const { rowPanel: _rp, ...rest } = draft as DashboardTile & { rowPanel?: string };
    const mode = layoutModeForParent(selectedParentId);
    const prelim: DashboardTile = {
      ...rest,
      grid: {
        col: g.col,
        row: g.row,
        colSpan: clampGridColSpan(g.colSpan),
        rowSpan: clampGridRowSpan(g.rowSpan),
      },
    };
    const nextG =
      mode === "strip" ? clampGroupChildGridPlacement(prelim, false) : clampTileGridPlacement(prelim);
    onSave(
      {
        ...rest,
        grid: {
          col: nextG.col,
          row: nextG.row,
          colSpan: nextG.colSpan,
          rowSpan: nextG.rowSpan,
        },
      },
      selectedParentId,
    );
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if draft}
  {@const gridMode = layoutModeForParent(selectedParentId)}
  {@const manifest = manifestFor(draft.pluginId)}
  {@const hosts = hostChoices(manifest)}
  {@const ud = manifest?.ui_dashboard}
  {@const showCompact = ud?.supports_compact !== false}
  {@const showFull = ud?.supports_full !== false}
  {@const perfSettings = resolvePluginTileSettings(draft.pluginId)}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="presentation"
    data-testid="tile-settings-overlay"
    onclick={onBackdropClick}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tile-settings-title"
      tabindex="-1"
      class="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl outline-none dark:border-gray-700 dark:bg-gray-800"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-6">
        <h2 id="tile-settings-title" class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Tile settings
        </h2>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {draft.pluginId}
        </p>

        <div class="space-y-4">
          {#if perfSettings}
            {@const PerfForm = perfSettings}
            <PerfForm bind:draft />
          {/if}

          <TilePlacementForm
            bind:draft
            bind:selectedParentId
            {gridMode}
            {parentOptions}
            {containerWidthColumns}
            {reClampGridForParent}
          />

          <TileGenericFields bind:draft {hosts} {showCompact} {showFull} />
        </div>
      </div>

      <div
        class="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-600 dark:bg-gray-900 {onDelete
          ? 'justify-between'
          : 'justify-end'}"
      >
        {#if onDelete}
          <button
            type="button"
            data-testid="tile-settings-delete"
            class="rounded-lg border border-red-200 px-4 py-2.5 text-center text-sm font-medium text-red-600 hover:bg-red-50 focus:ring-4 focus:ring-red-200 focus:outline-none dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 dark:focus:ring-red-900"
            onclick={onDelete}
          >
            Remove from dashboard
          </button>
        {/if}
        <div class="flex shrink-0 gap-2">
          <Button type="button" color="alternative" onclick={onClose}>Cancel</Button>
          <button
            type="button"
            class="rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-none dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            onclick={save}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
