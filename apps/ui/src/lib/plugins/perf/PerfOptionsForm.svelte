<script lang="ts">
  import type { TileDisplayStyle } from "../../api/types";
  import type { DashboardTile } from "../../dashboard/types";
  import { clampGridColSpan } from "../builtinMeta";
  import PerfGaugeGradientSelect from "./PerfGaugeGradientSelect.svelte";

  let { draft = $bindable() }: { draft: DashboardTile } = $props();

  function toggleCpuTotal(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    draft = { ...draft, options: { ...draft.options, cpu_total: input.checked } };
  }

  function toggleNetworkShowTotal(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const showTotal = input.checked;
    draft = {
      ...draft,
      options: { ...draft.options, network_by_adapter: showTotal ? false : true },
    };
  }

  function toggleDiskShowTotal(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const showTotal = input.checked;
    draft = {
      ...draft,
      options: { ...draft.options, disk_by_volume: showTotal ? false : true },
    };
  }
</script>

{#if draft.pluginId === "perf.summary"}
  <div class="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-600">
    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Performance</span>
    <div class="space-y-2">
      <span class="text-xs font-medium text-gray-600 dark:text-gray-300">Show as total</span>
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={draft.options?.cpu_total === true} onclick={toggleCpuTotal} />
        CPU
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={draft.options?.network_by_adapter === false}
          onclick={toggleNetworkShowTotal}
        />
        Network
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={draft.options?.disk_by_volume === false} onclick={toggleDiskShowTotal} />
        Disk
      </label>
    </div>
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
    <PerfGaugeGradientSelect bind:draft />
  </div>
{:else if draft.pluginId === "perf.cpu"}
  <div class="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-600">
    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">CPU tile</span>
    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input type="checkbox" checked={draft.options?.cpu_total === true} onclick={toggleCpuTotal} />
      Show as total
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
    <PerfGaugeGradientSelect bind:draft />
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
        checked={draft.options?.network_by_adapter === false}
        onclick={toggleNetworkShowTotal}
      />
      Show as total
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
    <PerfGaugeGradientSelect bind:draft />
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
      <input type="checkbox" checked={draft.options?.disk_by_volume === false} onclick={toggleDiskShowTotal} />
      Show as total
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
    <PerfGaugeGradientSelect bind:draft />
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
    <PerfGaugeGradientSelect bind:draft />
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
