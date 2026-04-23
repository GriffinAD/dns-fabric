<script lang="ts">
  import type { DisplayMode, HostControl } from "../api/types";
  import type { DashboardTile } from "./types";

  let {
    draft = $bindable<DashboardTile>(),
    hosts,
    showCompact,
    showFull,
  }: {
    draft: DashboardTile;
    hosts: HostControl[];
    showCompact: boolean;
    showFull: boolean;
  } = $props();
</script>

<label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
  <span>Display mode</span>
  <select
    class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
    value={draft.displayMode}
    onchange={(e) => {
      draft = { ...draft, displayMode: (e.currentTarget as HTMLSelectElement).value as DisplayMode };
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
      draft = { ...draft, hostControl: (e.currentTarget as HTMLSelectElement).value as HostControl };
    }}
  >
    {#each hosts as hc (hc)}
      <option value={hc}>{hc}</option>
    {/each}
  </select>
</label>
