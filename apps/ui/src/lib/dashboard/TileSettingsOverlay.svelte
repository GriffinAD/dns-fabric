<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";

  import type { DisplayMode, HostControl, PluginEntry, TileDisplayStyle } from "../api/types";
  import {
    clampGridColSpan,
    clampGridRowSpan,
    GRID_COLUMNS,
    tileColSpan,
  } from "./gridPlacement";
  import type { DashboardTile } from "./types";

  let {
    tile,
    plugins,
    onClose,
    onSave,
  }: {
    tile: DashboardTile;
    plugins: PluginEntry[];
    onClose: () => void;
    onSave: (next: DashboardTile) => void;
  } = $props();

  function cloneDraft(from: DashboardTile): DashboardTile {
    const g = from.grid;
    const cs = g != null ? clampGridColSpan(g.colSpan) : tileColSpan(from);
    const rs = g != null ? clampGridRowSpan(g.rowSpan) : 1;
    return {
      ...from,
      grid: { col: g?.col ?? 0, row: g?.row ?? 0, colSpan: cs, rowSpan: rs },
      options: from.options ? { ...from.options } : undefined,
    };
  }

  // svelte-ignore state_referenced_locally
  let draft = $state(cloneDraft(tile));

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
    onSave({
      ...draft,
      grid: {
        col: g.col,
        row: g.row,
        colSpan: clampGridColSpan(g.colSpan),
        rowSpan: clampGridRowSpan(g.rowSpan),
      },
    });
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
  {@const manifest = manifestFor(draft.pluginId)}
  {@const hosts = hostChoices(manifest)}
  {@const ud = manifest?.ui_dashboard}
  {@const showCompact = ud?.supports_compact !== false}
  {@const showFull = ud?.supports_full !== false}
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
                  const col = Math.min(draft!.grid!.col, GRID_COLUMNS - cs);
                  draft = {
                    ...draft!,
                    grid: { ...draft!.grid!, colSpan: cs, col },
                  };
                }}
              />
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
                    ...draft!,
                    grid: { ...draft!.grid!, rowSpan: clampGridRowSpan(n) },
                  };
                }}
              />
            </label>
            <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span>Column (0–11)</span>
              <input
                type="number"
                min="0"
                max={GRID_COLUMNS - 1}
                class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={draft.grid!.col}
                oninput={(e) => {
                  const n = Number((e.currentTarget as HTMLInputElement).value);
                  const cs = draft!.grid!.colSpan;
                  const col = Math.max(0, Math.min(GRID_COLUMNS - cs, Math.floor(n)));
                  draft = {
                    ...draft!,
                    grid: { ...draft!.grid!, col },
                  };
                }}
              />
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
                    ...draft!,
                    grid: { ...draft!.grid!, row },
                  };
                }}
              />
            </label>
          </div>

          <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            <span>Display mode</span>
            <select
              class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              value={draft.displayMode}
              onchange={(e) => {
                draft = { ...draft!, displayMode: (e.currentTarget as HTMLSelectElement).value as DisplayMode };
              }}
            >
              {#if showCompact}
                <option value="compact">compact</option>
              {/if}
              {#if showFull}
                <option value="full">full</option>
              {/if}
              {#if !showCompact && !showFull}
                <option value="compact">compact</option>
                <option value="full">full</option>
              {/if}
            </select>
          </label>

          <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            <span>Host control</span>
            <select
              class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              value={draft.hostControl}
              onchange={(e) => {
                draft = { ...draft!, hostControl: (e.currentTarget as HTMLSelectElement).value as HostControl };
              }}
            >
              {#each hosts as hc (hc)}
                <option value={hc}>{hc}</option>
              {/each}
            </select>
          </label>

          {#if draft.pluginId === "perf.summary"}
            <div class="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-600">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Performance</span>
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.options?.cpu_total !== false}
                  onchange={() => {
                    const cur = draft!.options?.cpu_total !== false;
                    draft = { ...draft!, options: { ...draft!.options, cpu_total: !cur } };
                  }}
                />
                CPU single total
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={Boolean(draft.options?.network_by_adapter)}
                  onchange={() => {
                    const cur = Boolean(draft!.options?.network_by_adapter);
                    draft = { ...draft!, options: { ...draft!.options, network_by_adapter: !cur } };
                  }}
                />
                Network per adapter
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={Boolean(draft.options?.disk_by_volume)}
                  onchange={() => {
                    const cur = Boolean(draft!.options?.disk_by_volume);
                    draft = { ...draft!, options: { ...draft!.options, disk_by_volume: !cur } };
                  }}
                />
                Disk per volume
              </label>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Perf display</span>
                <select
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  data-testid="tile-settings-perf-display"
                  value={draft.options?.display_style ?? "gauge"}
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLSelectElement).value as TileDisplayStyle;
                    draft = { ...draft!, options: { ...draft!.options, display_style: v } };
                  }}
                >
                  <option value="gauge">Gauges</option>
                  <option value="percent_only">Percent list</option>
                </select>
              </label>
            </div>
          {:else if draft.pluginId === "perf.cpu"}
            <div class="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-600">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">CPU tile</span>
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.options?.cpu_total !== false}
                  onchange={() => {
                    const cur = draft!.options?.cpu_total !== false;
                    draft = { ...draft!, options: { ...draft!.options, cpu_total: !cur } };
                  }}
                />
                Single CPU gauge (total)
              </label>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Presentation</span>
                <select
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={draft.options?.display_style ?? "gauge"}
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLSelectElement).value as TileDisplayStyle;
                    draft = { ...draft!, options: { ...draft!.options, display_style: v } };
                  }}
                >
                  <option value="gauge">Gauges</option>
                  <option value="percent_only">Percent list</option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Max gauge columns (empty = 12)</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={draft.options?.perf_max_cols != null ? String(draft.options.perf_max_cols) : ""}
                  oninput={(e) => {
                    const raw = (e.currentTarget as HTMLInputElement).value.trim();
                    if (raw === "") {
                      draft = { ...draft!, options: { ...draft!.options, perf_max_cols: undefined } };
                      return;
                    }
                    const n = clampGridColSpan(Number(raw));
                    draft = { ...draft!, options: { ...draft!.options, perf_max_cols: n } };
                  }}
                />
              </label>
            </div>
          {:else if draft.pluginId === "perf.network"}
            <div class="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-600">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Network tile</span>
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={Boolean(draft.options?.network_by_adapter)}
                  onchange={() => {
                    const cur = Boolean(draft!.options?.network_by_adapter);
                    draft = { ...draft!, options: { ...draft!.options, network_by_adapter: !cur } };
                  }}
                />
                One gauge per adapter
              </label>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Presentation</span>
                <select
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={draft.options?.display_style ?? "gauge"}
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLSelectElement).value as TileDisplayStyle;
                    draft = { ...draft!, options: { ...draft!.options, display_style: v } };
                  }}
                >
                  <option value="gauge">Gauges</option>
                  <option value="percent_only">Percent list</option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Max gauge columns (empty = 12)</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={draft.options?.perf_max_cols != null ? String(draft.options.perf_max_cols) : ""}
                  oninput={(e) => {
                    const raw = (e.currentTarget as HTMLInputElement).value.trim();
                    if (raw === "") {
                      draft = { ...draft!, options: { ...draft!.options, perf_max_cols: undefined } };
                      return;
                    }
                    const n = clampGridColSpan(Number(raw));
                    draft = { ...draft!, options: { ...draft!.options, perf_max_cols: n } };
                  }}
                />
              </label>
            </div>
          {:else if draft.pluginId === "perf.disk"}
            <div class="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-600">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Disk tile</span>
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={Boolean(draft.options?.disk_by_volume)}
                  onchange={() => {
                    const cur = Boolean(draft!.options?.disk_by_volume);
                    draft = { ...draft!, options: { ...draft!.options, disk_by_volume: !cur } };
                  }}
                />
                One gauge per volume
              </label>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Presentation</span>
                <select
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={draft.options?.display_style ?? "gauge"}
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLSelectElement).value as TileDisplayStyle;
                    draft = { ...draft!, options: { ...draft!.options, display_style: v } };
                  }}
                >
                  <option value="gauge">Gauges</option>
                  <option value="percent_only">Percent list</option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Max gauge columns (empty = 12)</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={draft.options?.perf_max_cols != null ? String(draft.options.perf_max_cols) : ""}
                  oninput={(e) => {
                    const raw = (e.currentTarget as HTMLInputElement).value.trim();
                    if (raw === "") {
                      draft = { ...draft!, options: { ...draft!.options, perf_max_cols: undefined } };
                      return;
                    }
                    const n = clampGridColSpan(Number(raw));
                    draft = { ...draft!, options: { ...draft!.options, perf_max_cols: n } };
                  }}
                />
              </label>
            </div>
          {:else if draft.pluginId === "perf.ram"}
            <div class="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-600">
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Memory tile</span>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Presentation</span>
                <select
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  data-testid="tile-settings-perf-display"
                  value={draft.options?.display_style ?? "gauge"}
                  onchange={(e) => {
                    const v = (e.currentTarget as HTMLSelectElement).value as TileDisplayStyle;
                    draft = { ...draft!, options: { ...draft!.options, display_style: v } };
                  }}
                >
                  <option value="gauge">Gauges</option>
                  <option value="percent_only">Percent list</option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span>Max gauge columns (empty = 12)</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={draft.options?.perf_max_cols != null ? String(draft.options.perf_max_cols) : ""}
                  oninput={(e) => {
                    const raw = (e.currentTarget as HTMLInputElement).value.trim();
                    if (raw === "") {
                      draft = { ...draft!, options: { ...draft!.options, perf_max_cols: undefined } };
                      return;
                    }
                    const n = clampGridColSpan(Number(raw));
                    draft = { ...draft!, options: { ...draft!.options, perf_max_cols: n } };
                  }}
                />
              </label>
            </div>
          {/if}
        </div>
      </div>

      <div
        class="flex shrink-0 justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-600 dark:bg-gray-900"
      >
        <Button type="button" color="alternative" onclick={onClose}>Cancel</Button>
        <!-- Flowbite `brand` can render low-contrast on light footers; keep Save explicit. -->
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
{/if}
