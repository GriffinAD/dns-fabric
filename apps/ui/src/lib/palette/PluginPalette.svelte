<script lang="ts">
  import type { PluginEntry } from "../api/types";
  import { buildPaletteCatalog } from "./paletteCatalog";
  import { loadPinnedPaletteIds, loadRecentPaletteIds, recordRecentPaletteId, savePinnedPaletteIds } from "./paletteStorage";
  import { setPaletteAddGroupDragData, setPalettePluginDragData } from "./paletteDragCodec";
  import type { PaletteItem } from "./types";

  let {
    plugins = [] as PluginEntry[],
    onAddTile,
    onAddGroup,
  }: {
    plugins?: PluginEntry[];
    onAddTile?: (pluginId: string) => void;
    onAddGroup?: () => void;
  } = $props();

  let q = $state("");
  let tab = $state<string>("All");
  let pinnedIds = $state(loadPinnedPaletteIds());

  const catalog = $derived(buildPaletteCatalog(plugins));
  const categories = $derived.by(() => {
    const s = new Set<string>();
    for (const p of catalog) s.add(p.category);
    return ["All", ...[...s].sort((a, b) => a.localeCompare(b))];
  });

  const filtered = $derived.by(() => {
    const needle = q.trim().toLowerCase();
    return catalog.filter((p) => {
      if (tab !== "All" && p.category !== tab) return false;
      if (!needle) return true;
      return p.searchText.includes(needle);
    });
  });

  const recent = $derived(loadRecentPaletteIds());

  function togglePin(id: string) {
    const cur = loadPinnedPaletteIds();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    savePinnedPaletteIds(next);
    pinnedIds = next;
  }

  function onChipClick(item: PaletteItem) {
    if (item.kind === "core" && item.id === "core:add-group") {
      onAddGroup?.();
      return;
    }
    if (item.kind === "plugin") {
      recordRecentPaletteId(item.id);
      onAddTile?.(item.id);
    }
  }

  function onChipKeydown(e: KeyboardEvent, item: PaletteItem) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChipClick(item);
    }
  }
</script>

<div
  class="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-800/50"
  data-testid="layout-edit-palette-v2"
  aria-label="Add dashboard plugins"
>
  <div class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
    <label class="sr-only" for="palette-search">Search palette</label>
    <input
      id="palette-search"
      class="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
      placeholder="Search plugins…"
      bind:value={q}
      autocomplete="off"
    />
  </div>
  <div class="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Palette categories">
    {#each categories as c (c)}
      <button
        type="button"
        role="tab"
        aria-selected={tab === c}
        class="rounded px-2 py-0.5 text-xs font-medium {tab === c
          ? 'bg-primary-600 text-white'
          : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}"
        onclick={() => {
          tab = c;
        }}
      >
        {c}
      </button>
    {/each}
  </div>
  {#if pinnedIds.length > 0}
    <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400">Pinned</p>
    <div class="mb-2 flex flex-wrap gap-2">
      {#each catalog.filter((i) => i.kind === "plugin" && pinnedIds.includes(i.id)) as p (p.id)}
        <button
          type="button"
          class="rounded border border-amber-400/80 bg-amber-50 px-2 py-1 text-xs dark:border-amber-700 dark:bg-amber-950/40"
          onclick={() => togglePin(p.id)}
        >
          Unpin {p.label}
        </button>
      {/each}
    </div>
  {/if}
  {#if recent.length > 0 && q.trim() === ""}
    <p class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400">Recent</p>
    <div class="mb-2 flex flex-wrap gap-2">
      {#each recent as rid (rid)}
        {@const item = catalog.find((i) => i.kind === "plugin" && i.id === rid)}
        {#if item && item.kind === "plugin"}
          <button
            type="button"
            draggable="true"
            class="cursor-grab rounded-lg bg-gray-200 px-3 py-1 text-xs dark:bg-gray-700"
            aria-label="Add {item.label}"
            ondragstart={(e: DragEvent) => setPalettePluginDragData(e, item.id)}
            onclick={() => onChipClick(item)}
          >
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
  <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">
    <strong>Containers:</strong> use <span class="font-mono">Add container</span> or drag it. <strong>Tiles:</strong> drag
    a chip or press Enter when focused.
  </p>
  <div class="flex flex-col gap-2">
    {#each filtered as item, idx (`${item.kind}-${item.kind === "plugin" ? item.id : item.id}-${idx}`)}
      {#if item.kind === "core" && item.id === "core:add-group" && onAddGroup}
        <button
          type="button"
          draggable="true"
          tabindex="0"
          class="cursor-grab select-none rounded-lg border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:bg-primary-500 dark:hover:bg-primary-600"
          data-testid="layout-add-container"
          aria-label={item.label}
          onkeydown={(e) => onChipKeydown(e, item)}
          ondragstart={(e: DragEvent) => setPaletteAddGroupDragData(e)}
          onclick={() => onAddGroup?.()}
        >
          {item.label}
        </button>
      {:else if item.kind === "plugin"}
        <div class="flex flex-wrap items-center gap-1">
          <button
            type="button"
            draggable="true"
            tabindex="0"
            class="cursor-grab select-none rounded-lg border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:bg-primary-500 dark:hover:bg-primary-600"
            aria-label="Add {item.label}"
            data-testid="palette-plugin-{item.id}"
            onkeydown={(e) => onChipKeydown(e, item)}
            ondragstart={(e: DragEvent) => setPalettePluginDragData(e, item.id)}
            onclick={() => onChipClick(item)}
          >
            {item.label}
          </button>
          <button
            type="button"
            class="rounded border border-gray-300 px-1 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300"
            aria-label="Pin or unpin {item.label}"
            onclick={() => togglePin(item.id)}
          >
            {pinnedIds.includes(item.id) ? "★" : "☆"}
          </button>
        </div>
      {/if}
    {/each}
  </div>
  {#if filtered.length === 0}
    <p class="mt-2 text-sm text-gray-500 dark:text-gray-400" role="status">No palette items match this filter.</p>
  {/if}
</div>
