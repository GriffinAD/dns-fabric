<script lang="ts">
  import type { TileDisplayStyle } from "../api/types";
  import { clampGridColSpan } from "./gridPlacement";
  import type { DashboardTile } from "./types";

  let { draft = $bindable() }: { draft: DashboardTile } = $props();
</script>

{#if draft.pluginId === "perf.summary"}
  <div class="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-600">
    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Performance</span>
    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        checked={draft.options?.cpu_total !== true}
        onchange={() => {
          const perCore = draft.options?.cpu_total !== true;
          draft = { ...draft, options: { ...draft.options, cpu_total: perCore ? true : false } };
        }}
      />
      One gauge per core
    </label>
    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        checked={Boolean(draft.options?.network_by_adapter)}
        onchange={() => {
          const cur = Boolean(draft.options?.network_by_adapter);
          draft = { ...draft, options: { ...draft.options, network_by_adapter: !cur } };
        }}
      />
      Network per adapter
    </label>
    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        checked={Boolean(draft.options?.disk_by_volume)}
        onchange={() => {
          const cur = Boolean(draft.options?.disk_by_volume);
          draft = { ...draft, options: { ...draft.options, disk_by_volume: !cur } };
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
          draft = { ...draft, options: { ...draft.options, display_style: v } };
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
        checked={draft.options?.cpu_total !== true}
        onchange={() => {
          const perCore = draft.options?.cpu_total !== true;
          draft = { ...draft, options: { ...draft.options, cpu_total: perCore ? true : false } };
        }}
      />
      One gauge per core
    </label>
    <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
      <span>Presentation</span>
      <select
        class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        value={draft.options?.display_style ?? "gauge"}
        onchange={(e) => {
          const v = (e.currentTarget as HTMLSelectElement).value as TileDisplayStyle;
          draft = { ...draft, options: { ...draft.options, display_style: v } };
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
            draft = { ...draft, options: { ...draft.options, perf_max_cols: undefined } };
            return;
          }
          const n = clampGridColSpan(Number(raw));
          draft = { ...draft, options: { ...draft.options, perf_max_cols: n } };
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
          const cur = Boolean(draft.options?.network_by_adapter);
          draft = { ...draft, options: { ...draft.options, network_by_adapter: !cur } };
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
          draft = { ...draft, options: { ...draft.options, display_style: v } };
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
            draft = { ...draft, options: { ...draft.options, perf_max_cols: undefined } };
            return;
          }
          const n = clampGridColSpan(Number(raw));
          draft = { ...draft, options: { ...draft.options, perf_max_cols: n } };
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
          const cur = Boolean(draft.options?.disk_by_volume);
          draft = { ...draft, options: { ...draft.options, disk_by_volume: !cur } };
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
          draft = { ...draft, options: { ...draft.options, display_style: v } };
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
            draft = { ...draft, options: { ...draft.options, perf_max_cols: undefined } };
            return;
          }
          const n = clampGridColSpan(Number(raw));
          draft = { ...draft, options: { ...draft.options, perf_max_cols: n } };
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
          draft = { ...draft, options: { ...draft.options, display_style: v } };
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
            draft = { ...draft, options: { ...draft.options, perf_max_cols: undefined } };
            return;
          }
          const n = clampGridColSpan(Number(raw));
          draft = { ...draft, options: { ...draft.options, perf_max_cols: n } };
        }}
      />
    </label>
  </div>
{/if}
