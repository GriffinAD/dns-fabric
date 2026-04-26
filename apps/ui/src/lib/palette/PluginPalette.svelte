<script lang="ts">
  import { get } from "svelte/store";
  import { onDestroy } from "svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";

  import type { PluginEntry } from "../api/types";
  import { buildPaletteCatalog } from "./paletteCatalog";
  import {
    paletteDisplaySettings,
    type PaletteDisplaySettings,
  } from "./paletteDisplaySettings";
  import {
    clampPaletteFloatPosition,
    defaultPaletteFloatPosition,
    loadPaletteDockMode,
    loadPaletteFloatPosition,
    loadPinnedPaletteIds,
    loadRecentPaletteIds,
    recordRecentPaletteId,
    savePaletteDockMode,
    savePaletteFloatPosition,
    savePinnedPaletteIds,
    type PaletteDockMode,
    type PaletteFloatPosition,
  } from "./paletteStorage";
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
  let dockMode = $state<PaletteDockMode>(loadPaletteDockMode());
  let floatPos = $state<PaletteFloatPosition | null>(
    typeof window !== "undefined" && loadPaletteDockMode() === "float"
      ? loadPaletteFloatPosition() ?? defaultPaletteFloatPosition(window.innerWidth, window.innerHeight)
      : null,
  );
  let shellEl = $state<HTMLDivElement | undefined>(undefined);
  let dragState = $state<{ pid: number; sx: number; sy: number; sl: number; st: number } | null>(null);
  let dragMoveListener: ((ev: PointerEvent) => void) | null = null;
  let dragEndListener: ((ev: PointerEvent) => void) | null = null;

  let paletteDisplay = $state<PaletteDisplaySettings>(get(paletteDisplaySettings));
  $effect(() => {
    const unsubscribe = paletteDisplaySettings.subscribe((v) => {
      paletteDisplay = v;
    });
    return unsubscribe;
  });

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

  function setDock(next: PaletteDockMode) {
    dockMode = next;
    savePaletteDockMode(next);
    if (next === "float" && typeof window !== "undefined") {
      floatPos =
        floatPos ??
        loadPaletteFloatPosition() ??
        defaultPaletteFloatPosition(window.innerWidth, window.innerHeight);
    }
  }

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

  function detachDragWindowListeners() {
    if (dragMoveListener) {
      window.removeEventListener("pointermove", dragMoveListener);
      dragMoveListener = null;
    }
    if (dragEndListener) {
      window.removeEventListener("pointerup", dragEndListener);
      window.removeEventListener("pointercancel", dragEndListener);
      dragEndListener = null;
    }
  }

  function onDragPointerDown(e: PointerEvent) {
    if (dockMode !== "float" || !floatPos || !shellEl) return;
    if (e.button !== 0) return;
    e.preventDefault();
    dragState = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, sl: floatPos.left, st: floatPos.top };

    const onMove = (ev: PointerEvent) => {
      if (!dragState || ev.pointerId !== dragState.pid || !shellEl || !floatPos) return;
      const r = shellEl.getBoundingClientRect();
      const nextL = dragState.sl + (ev.clientX - dragState.sx);
      const nextT = dragState.st + (ev.clientY - dragState.sy);
      floatPos = clampPaletteFloatPosition(nextL, nextT, r.width, r.height, window.innerWidth, window.innerHeight);
    };

    const onEnd = (ev: PointerEvent) => {
      if (!dragState || ev.pointerId !== dragState.pid) return;
      detachDragWindowListeners();
      dragState = null;
      if (floatPos) savePaletteFloatPosition(floatPos);
    };

    dragMoveListener = onMove;
    dragEndListener = onEnd;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }

  /**
   * Transparent root carries layout + box-shadow only. Inner chrome holds `backdrop-filter`
   * so the shadow is not composited away in WebKit.
   */
  const shellRootClass = $derived.by(() => {
    /**
     * Light: contact shadow (20px blur) + soft 0-offset halo so the falloff feathers toward the canvas (no spread).
     * Dark keeps the offset stack tuned for charcoal UIs.
     */
    const shadow = paletteDisplay.dropShadow
      ? "shadow-[0_4px_20px_0_rgba(120,124,134,0.48),0_0_36px_rgba(120,124,134,0.14)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_6px_22px_rgba(0,0,0,0.45),0_18px_48px_rgba(0,0,0,0.55)]"
      : "shadow-none";
    const base = `overflow-visible rounded-lg bg-transparent p-0 ${shadow}`;
    if (dockMode === "float") {
      return `${base} fixed z-[70] flex max-h-[min(70vh,30rem)] min-h-0 w-[min(17.5rem,calc(100vw-2rem))] flex-col`;
    }
    if (dockMode === "sticky") {
      return `${base} sticky top-20 z-20`;
    }
    return base;
  });

  const shellChromeClass = $derived.by(() => {
    /**
     * Same glass numbers as dark: 70% fill, 45% border, 2.5px blur — light uses theme `gray-350` (between 300/400).
     *
     * TODO: Revisit light-mode `backdrop-blur` (strength vs perf, perceptual match to dark glass); currently mirrors 2.5px.
     */
    const base = paletteDisplay.transparency
      ? "w-full rounded-lg border border-gray-400/45 bg-gray-350/70 text-[13px] leading-snug text-gray-900 backdrop-blur-[2.5px] dark:border-gray-800/45 dark:bg-gray-800/70 dark:text-gray-100"
      : "w-full rounded-lg border border-gray-400/45 bg-gray-350 text-[13px] leading-snug text-gray-900 backdrop-blur-none dark:border-gray-800/45 dark:bg-gray-800 dark:text-gray-100";
    if (dockMode === "float") {
      return `${base} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`;
    }
    return base;
  });

  const shellBodyClass = $derived.by(() => {
    if (dockMode === "float") {
      return "min-h-0 min-w-0 flex-1 overflow-y-auto p-2";
    }
    return "p-2";
  });

  const shellStyle = $derived.by((): string | undefined => {
    if (dockMode !== "float" || !floatPos) return undefined;
    return `left:${floatPos.left}px;top:${floatPos.top}px`;
  });

  onDestroy(() => {
    detachDragWindowListeners();
  });
</script>

<div
  class={shellRootClass}
  style={shellStyle}
  data-testid="layout-edit-palette-v2"
  aria-label="Add tiles to the dashboard"
>
  <div bind:this={shellEl} class={shellChromeClass} data-testid="layout-edit-palette-chrome">
    <div class={shellBodyClass}>
  <div class="mb-1.5 flex flex-wrap items-center gap-1 border-b border-gray-300/55 pb-1.5 dark:border-gray-600/80">
    {#if dockMode === "float"}
      <button
        type="button"
        class="flex min-h-7 min-w-0 flex-1 cursor-grab touch-none items-center gap-1 rounded border-0 bg-transparent px-0.5 py-0.5 text-left hover:bg-gray-900/5 active:cursor-grabbing dark:hover:bg-gray-800/60"
        data-float-drag-handle="true"
        data-testid="palette-float-drag-handle"
        aria-label="Drag to move tiles panel"
        aria-grabbed={dragState !== null}
        onpointerdown={onDragPointerDown}
      >
        <GripVertical class="h-3.5 w-3.5 shrink-0 text-gray-600 dark:text-gray-400" aria-hidden="true" />
        <span class="text-[12px] font-semibold text-gray-900 dark:text-gray-200">Tiles</span>
      </button>
    {:else}
      <span class="text-[12px] font-semibold text-gray-900 dark:text-gray-200">Tiles</span>
    {/if}
    <div class="flex shrink-0 gap-0.5 rounded-md bg-gray-900/8 p-0.5 dark:bg-gray-800/80" role="group" aria-label="Tiles panel position">
      <button
        type="button"
        class="rounded px-1.5 py-0.5 text-[10px] font-medium {dockMode === 'inline'
          ? 'bg-white/90 text-gray-900 shadow-sm ring-1 ring-gray-900/10 dark:bg-gray-700 dark:text-white dark:ring-0'
          : 'text-gray-800 hover:text-gray-950 dark:text-gray-400 dark:hover:text-gray-100'}"
        data-testid="palette-dock-inline"
        title="Panel scrolls with the page at the top of the editor"
        onclick={() => setDock("inline")}
      >
        Top
      </button>
      <button
        type="button"
        class="rounded px-1.5 py-0.5 text-[10px] font-medium {dockMode === 'sticky'
          ? 'bg-white/90 text-gray-900 shadow-sm ring-1 ring-gray-900/10 dark:bg-gray-700 dark:text-white dark:ring-0'
          : 'text-gray-800 hover:text-gray-950 dark:text-gray-400 dark:hover:text-gray-100'}"
        data-testid="palette-dock-sticky"
        title="Sticks under the header while you scroll the dashboard"
        onclick={() => setDock("sticky")}
      >
        Stick
      </button>
      <button
        type="button"
        class="rounded px-1.5 py-0.5 text-[10px] font-medium {dockMode === 'float'
          ? 'bg-white/90 text-gray-900 shadow-sm ring-1 ring-gray-900/10 dark:bg-gray-700 dark:text-white dark:ring-0'
          : 'text-gray-800 hover:text-gray-950 dark:text-gray-400 dark:hover:text-gray-100'}"
        data-testid="palette-dock-float"
        title="Floating panel — drag the grip to move; stays on screen while editing"
        onclick={() => setDock("float")}
      >
        Float
      </button>
    </div>
  </div>

  <div class="mb-1.5 flex flex-col gap-1 sm:flex-row sm:items-center">
    <label class="sr-only" for="palette-search">Search tiles</label>
    <input
      id="palette-search"
      class="w-full rounded border border-gray-400/45 bg-white/70 px-1.5 py-0.5 text-xs text-gray-900 shadow-sm placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:shadow-none"
      placeholder="Search…"
      bind:value={q}
      autocomplete="off"
    />
  </div>
  <div class="mb-1.5 flex flex-wrap gap-0.5" role="tablist" aria-label="Tile categories">
    {#each categories as c (c)}
      <button
        type="button"
        role="tab"
        aria-selected={tab === c}
        class="rounded px-1.5 py-px text-[10px] font-medium {tab === c
          ? 'bg-primary-600 text-white'
          : 'border border-gray-400/45 bg-white/70 text-gray-900 shadow-sm hover:bg-white/90 dark:border-transparent dark:bg-gray-700 dark:text-gray-100 dark:shadow-none dark:hover:bg-gray-600'}"
        onclick={() => {
          tab = c;
        }}
      >
        {c}
      </button>
    {/each}
  </div>
  {#if pinnedIds.length > 0}
    <p class="mb-0.5 text-[10px] font-semibold text-gray-900 dark:text-gray-400">Pinned</p>
    <div class="mb-1 flex flex-wrap gap-1">
      {#each catalog.filter((i) => i.kind === "plugin" && pinnedIds.includes(i.id)) as p (p.id)}
        <button
          type="button"
          class="rounded border border-amber-400/70 bg-amber-50 px-1.5 py-px text-[10px] dark:border-amber-700 dark:bg-amber-950/40"
          onclick={() => togglePin(p.id)}
        >
          Unpin {p.label}
        </button>
      {/each}
    </div>
  {/if}
  {#if recent.length > 0 && q.trim() === ""}
    <p class="mb-0.5 text-[10px] font-semibold text-gray-900 dark:text-gray-400">Recent</p>
    <div class="mb-1 flex flex-wrap gap-1">
      {#each recent as rid (rid)}
        {@const item = catalog.find((i) => i.kind === "plugin" && i.id === rid)}
        {#if item && item.kind === "plugin"}
          <button
            type="button"
            draggable="true"
            class="cursor-grab rounded border border-gray-400/45 bg-white/70 px-1.5 py-px text-[10px] font-medium text-gray-900 shadow-sm hover:bg-white/90 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:shadow-none dark:hover:bg-gray-700"
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
  <details class="mb-1.5 text-[10px] text-gray-900 dark:text-gray-400">
    <summary class="cursor-pointer select-none text-gray-800 hover:text-gray-950 dark:text-gray-500 dark:hover:text-gray-200">
      How to add tiles
    </summary>
    <p class="mt-1 pl-0.5">
      <strong>Containers:</strong> <span class="font-mono">Add container</span> or drag it.
      <strong>Tiles:</strong> drag a chip or press Enter when focused.
    </p>
  </details>
  <div class="flex flex-col gap-1">
    {#each filtered as item, idx (`${item.kind}-${item.kind === "plugin" ? item.id : item.id}-${idx}`)}
      {#if item.kind === "core" && item.id === "core:add-group" && onAddGroup}
        <button
          type="button"
          draggable="true"
          tabindex="0"
          class="cursor-grab select-none rounded-md border border-transparent bg-primary-600 px-2 py-1 text-xs font-medium text-white shadow-md hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:bg-primary-500 dark:shadow-none dark:hover:bg-primary-600"
          data-testid="layout-add-container"
          aria-label={item.label}
          onkeydown={(e) => onChipKeydown(e, item)}
          ondragstart={(e: DragEvent) => setPaletteAddGroupDragData(e)}
          onclick={() => onAddGroup?.()}
        >
          {item.label}
        </button>
      {:else if item.kind === "plugin"}
        <div class="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            draggable="true"
            tabindex="0"
            class="cursor-grab select-none rounded-md border border-transparent bg-primary-600 px-2 py-1 text-xs font-medium text-white shadow-md hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:bg-primary-500 dark:shadow-none dark:hover:bg-primary-600"
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
            class="rounded border border-gray-400/45 bg-white/70 px-1 text-[10px] leading-none font-medium text-gray-900 shadow-sm hover:bg-white/90 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:shadow-none dark:hover:bg-gray-700"
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
    <p class="mt-1 text-xs text-gray-900 dark:text-gray-400" role="status">No tiles match this filter.</p>
  {/if}
    </div>
  </div>
</div>
