<script lang="ts">
  import { draggable, dndState } from "@thisux/sveltednd";
  import { get } from "svelte/store";
  import { onDestroy } from "svelte";
  import GripVertical from "lucide-svelte/icons/grip-vertical";

  import type { PluginEntry } from "../api/types";
  import type { DataGateway } from "../gateway/dataGateway";
  import PluginTileMount from "../dashboard/PluginTileMount.svelte";
  import type { DashboardTile } from "../dashboard/types";
  import {
    PALETTE_ADD_GROUP_CONTAINER,
    paletteAddGroupPayload,
    palettePluginContainer,
    palettePluginPayload,
    parseDragPayload,
  } from "../dashboard/interactions/dashboardSveltedndTypes";
  import { tileColSpanForPlugin } from "../plugins/core/pluginGridPolicy";
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
  import type { PaletteItem } from "./types";

  const PALETTE_CHIP_DRAG = '[data-testid="palette-chip-drag"]';
  const PALETTE_ADD_GROUP_DRAG = '[data-testid="palette-add-group-drag"]';
  const SHOW_RECENTS = false;
  const paletteDragAttrs = {
    draggingClass: "opacity-55 ring-2 ring-primary-500/35 shadow-sm",
  };
  let dragImageTile = $state<DashboardTile | null>(null);
  let dragGhostEl = $state<HTMLDivElement | null>(null);
  let lastPointer = $state<{ x: number; y: number } | null>(null);
  let transparentDragImage: HTMLImageElement | null = null;
  /** Suppress chip click fired after a drag that did not drop on the grid. */
  let suppressChipClickAfterDrag = $state(false);

  let {
    plugins = [] as PluginEntry[],
    gateway,
    onAddTile,
    onAddGroup,
  }: {
    plugins?: PluginEntry[];
    gateway?: DataGateway;
    onAddTile?: (pluginId: string, insertBeforeIndex?: number) => void;
    onAddGroup?: (insertBeforeIndex?: number) => void;
  } = $props();

  function buildDragImageTile(pluginId: string): DashboardTile {
    return {
      id: "__palette-drag-image__",
      pluginId,
      hostControl: "single-panel",
      displayMode: "full",
      grid: { col: 0, row: 0, colSpan: tileColSpanForPlugin({ pluginId }), rowSpan: 1 },
    };
  }

  function preparePluginDragImage(pluginId: string): void {
    if (!gateway) return;
    if (dragImageTile?.pluginId === pluginId) return;
    dragImageTile = buildDragImageTile(pluginId);
  }

  /** After sveltednd sets effectAllowed=move, force copy semantics for palette → grid adds. */
  function onPaletteDragStartCapture(e: DragEvent): void {
    if (!e.dataTransfer) return;
    e.dataTransfer.effectAllowed = "copy";
  }

  function onPluginDragStart(e: DragEvent, pluginId: string): void {
    if (!e.dataTransfer || !gateway) return;
    onPaletteDragStartCapture(e);
  }

  function clearDragImage(): void {
    dragImageTile = null;
    if (dragGhostEl) {
      dragGhostEl.style.transform = "translate(-10000px, -10000px)";
    }
  }

  function palettePluginDragCallbacks(pluginId: string) {
    return {
      onDragStart: () => {
        suppressChipClickAfterDrag = false;
        rememberPointerFromDnd();
        preparePluginDragImage(pluginId);
        const p = lastPointer;
        if (p) positionDragGhost(p.x, p.y);
      },
      onDragEnd: () => {
        suppressChipClickAfterDrag = true;
        clearDragImage();
      },
    };
  }

  function paletteAddGroupDragCallbacks() {
    return {
      onDragStart: () => {
        suppressChipClickAfterDrag = false;
      },
      onDragEnd: () => {
        suppressChipClickAfterDrag = true;
        clearDragImage();
      },
    };
  }

  function rememberPointerFromDnd(): void {
    if (typeof window === "undefined") return;
    const ev = window.event;
    if (ev instanceof PointerEvent || ev instanceof MouseEvent) {
      lastPointer = { x: ev.clientX, y: ev.clientY };
    }
  }

  function rememberPointer(e: PointerEvent): void {
    lastPointer = { x: e.clientX, y: e.clientY };
  }

  function applyRenderedDragImage(e: DragEvent): void {
    if (!e.dataTransfer) return;
    if (!transparentDragImage && typeof Image !== "undefined") {
      transparentDragImage = new Image();
      transparentDragImage.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    }
    if (transparentDragImage) e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
  }

  function positionDragGhost(x: number, y: number): void {
    if (!dragGhostEl) return;
    dragGhostEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -18px)`;
  }

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
    if (suppressChipClickAfterDrag) {
      suppressChipClickAfterDrag = false;
      return;
    }
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
      return `${base} fixed z-[70] flex max-h-[min(80vh,40rem)] min-h-0 w-[min(17.5rem,calc(100vw-2rem))] flex-col`;
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
      ? "w-full rounded-lg border border-gray-400/45 bg-gray-300/65 text-[13px] leading-snug text-gray-900 backdrop-blur-[2.5px] dark:border-gray-800/45 dark:bg-gray-800/70 dark:text-gray-100"
      : "w-full rounded-lg border border-gray-400/45 bg-gray-300 text-[13px] leading-snug text-gray-900 backdrop-blur-none dark:border-gray-800/45 dark:bg-gray-800 dark:text-gray-100";
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

  $effect(() => {
    if (typeof document === "undefined") return;
    const applyForPalettePlugin = (e: DragEvent) => {
      if (!(e.target instanceof Element)) return;
      const hit = e.target.closest("[data-palette-drag-plugin-id]");
      if (!(hit instanceof HTMLElement)) return;
      const pluginId = hit.dataset.paletteDragPluginId;
      if (!pluginId || !gateway) return;
      const tile = buildDragImageTile(pluginId);
      const x = e.clientX > 0 ? e.clientX : (lastPointer?.x ?? 24);
      const y = e.clientY > 0 ? e.clientY : (lastPointer?.y ?? 24);
      dragImageTile = tile;
      preparePluginDragImage(pluginId);
      applyRenderedDragImage(e);
      requestAnimationFrame(() => positionDragGhost(x, y));
    };
    const onDocDragStartCapture = (e: DragEvent) => {
      applyForPalettePlugin(e);
      if (!(e.target instanceof Element) || !e.target.closest('[data-dashboard-editor="palette"]')) return;
      queueMicrotask(() => {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.dropEffect = "copy";
        }
      });
    };
    const onDocDragStartBubble = (e: DragEvent) => applyForPalettePlugin(e);
    const onDocDrag = (e: DragEvent) => {
      if (!dragImageTile) return;
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      if (e.clientX <= 0 && e.clientY <= 0) return;
      positionDragGhost(e.clientX, e.clientY);
    };
    const onDocDragOver = (e: DragEvent) => {
      if (!dragImageTile) return;
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      if (e.clientX <= 0 && e.clientY <= 0) return;
      positionDragGhost(e.clientX, e.clientY);
    };
    const onDocDragEnd = () => {
      dragImageTile = null;
    };
    document.addEventListener("dragstart", onDocDragStartCapture, true);
    document.addEventListener("dragstart", onDocDragStartBubble, false);
    document.addEventListener("drag", onDocDrag, true);
    document.addEventListener("dragover", onDocDragOver, true);
    document.addEventListener("dragend", onDocDragEnd, true);
    document.addEventListener("drop", onDocDragEnd, true);
    return () => {
      document.removeEventListener("dragstart", onDocDragStartCapture, true);
      document.removeEventListener("dragstart", onDocDragStartBubble, false);
      document.removeEventListener("drag", onDocDrag, true);
      document.removeEventListener("dragover", onDocDragOver, true);
      document.removeEventListener("dragend", onDocDragEnd, true);
      document.removeEventListener("drop", onDocDragEnd, true);
    };
  });

  $effect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (dragImageTile) {
      body.setAttribute("data-palette-drag-active", "true");
      return () => body.removeAttribute("data-palette-drag-active");
    }
    body.removeAttribute("data-palette-drag-active");
  });

  /** Sync floating preview with sveltednd palette drags; tear down only after drag ends (not on pointerdown). */
  let palettePreviewDragActive = false;
  $effect(() => {
    const dragging = dndState.isDragging;
    const drag = dragging ? parseDragPayload(dndState.draggedItem) : null;
    if (dragging && drag?.k === "pp" && gateway) {
      palettePreviewDragActive = true;
      preparePluginDragImage(drag.i);
      return;
    }
    if (!dragging && palettePreviewDragActive) {
      palettePreviewDragActive = false;
      clearDragImage();
    }
  });

  $effect(() => {
    if (!dragImageTile) return;
    const onMove = (e: PointerEvent) => {
      positionDragGhost(e.clientX, e.clientY);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  });

  onDestroy(() => {
    detachDragWindowListeners();
  });
</script>

<div
  class={shellRootClass}
  style={shellStyle}
  data-dashboard-editor="palette"
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
    <div class="flex shrink-0 gap-0.5 rounded-md bg-primary-100/80 p-0.5 dark:bg-primary-900/45" role="group" aria-label="Tiles panel position">
      <button
        type="button"
        class="rounded-sm px-1.5 py-0.5 text-[10px] font-medium {dockMode === 'inline'
          ? 'border border-primary-600 bg-primary-600 text-white shadow-sm dark:border-primary-500 dark:bg-primary-500'
          : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'}"
        data-testid="palette-dock-inline"
        title="Panel scrolls with the page at the top of the editor"
        onclick={() => setDock("inline")}
      >
        Top
      </button>
      <button
        type="button"
        class="rounded-sm px-1.5 py-0.5 text-[10px] font-medium {dockMode === 'sticky'
          ? 'border border-primary-600 bg-primary-600 text-white shadow-sm dark:border-primary-500 dark:bg-primary-500'
          : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'}"
        data-testid="palette-dock-sticky"
        title="Sticks under the header while you scroll the dashboard"
        onclick={() => setDock("sticky")}
      >
        Stick
      </button>
      <button
        type="button"
        class="rounded-sm px-1.5 py-0.5 text-[10px] font-medium {dockMode === 'float'
          ? 'border border-primary-600 bg-primary-600 text-white shadow-sm dark:border-primary-500 dark:bg-primary-500'
          : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'}"
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
        class="rounded-sm px-1.5 py-px text-[10px] font-medium {tab === c
          ? 'border border-primary-600 bg-primary-600 text-white shadow-sm dark:border-primary-500 dark:bg-primary-500'
          : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'}"
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
          class="rounded-sm border border-primary-500/45 bg-primary-500/15 px-1.5 py-px text-[10px] text-primary-900 hover:bg-primary-500/25 dark:border-primary-400/45 dark:bg-primary-500/20 dark:text-primary-100 dark:hover:bg-primary-500/30"
          aria-label="Add {p.label}"
          onclick={() => onAddTile?.(p.id)}
        >
          {p.label}
        </button>
      {/each}
    </div>
  {/if}
  {#if SHOW_RECENTS && recent.length > 0 && q.trim() === ""}
    <p class="mb-0.5 text-[10px] font-semibold text-gray-900 dark:text-gray-400">Recent</p>
    <div class="mb-1 flex flex-wrap gap-1">
      {#each recent as rid (rid)}
        {@const item = catalog.find((i) => i.kind === "plugin" && i.id === rid)}
        {#if item && item.kind === "plugin"}
          <div
            class="inline-flex items-center gap-0.5 rounded border border-gray-400/45 bg-white/70 px-0.5 py-px shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:shadow-none"
            data-palette-drag-plugin-id={item.id}
            use:draggable={{
              dragData: palettePluginPayload(item.id),
              container: palettePluginContainer(item.id),
              handle: PALETTE_CHIP_DRAG,
              attributes: paletteDragAttrs,
              callbacks: palettePluginDragCallbacks(item.id),
            }}
          >
            <button
              type="button"
              class="flex h-5 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-gray-600 hover:bg-gray-200/80 active:cursor-grabbing dark:text-gray-400 dark:hover:bg-gray-700/80"
              data-testid="palette-chip-drag"
              data-palette-drag-plugin-id={item.id}
              aria-label="Drag {item.label} onto the dashboard"
              onpointerdown={(e) => {
                rememberPointer(e);
                preparePluginDragImage(item.id);
              }}
              ondragstart={(e) => onPluginDragStart(e, item.id)}
              ondragend={clearDragImage}
            >
              <GripVertical class="h-3 w-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="rounded px-1 py-px text-[10px] font-medium text-gray-900 hover:bg-white/90 dark:text-gray-100 dark:hover:bg-gray-700"
              aria-label="Add {item.label}"
              onclick={() => onChipClick(item)}
            >
              {item.label}
            </button>
          </div>
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
        <div
          class="flex max-w-full items-center gap-1"
        >
          <div
            class="inline-flex min-w-0 flex-1 select-none items-center gap-1 rounded-md border border-gray-400/60 bg-gray-300/95 px-1 py-1 text-xs font-medium text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:shadow-none"
            ondragstartcapture={onPaletteDragStartCapture}
            use:draggable={{
              dragData: paletteAddGroupPayload(),
              container: PALETTE_ADD_GROUP_CONTAINER,
              handle: PALETTE_ADD_GROUP_DRAG,
              attributes: paletteDragAttrs,
              callbacks: paletteAddGroupDragCallbacks(),
            }}
          >
            <button
              type="button"
              tabindex="0"
              class="flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm hover:bg-gray-400/45 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:hover:bg-gray-600/90"
              data-testid="palette-add-group-drag"
              aria-label="Drag to add container on the dashboard"
              onpointerdown={rememberPointer}
              ondragend={clearDragImage}
            >
              <GripVertical class="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              tabindex="0"
              class="min-w-0 flex-1 cursor-pointer rounded-sm px-1 py-0.5 text-left hover:bg-gray-400/45 focus:ring-2 focus:ring-primary-500 focus:outline-none dark:hover:bg-gray-600/85"
              data-testid="layout-add-container"
              aria-label={item.label}
              onkeydown={(e) => onChipKeydown(e, item)}
              onclick={() => onAddGroup?.()}
            >
              {item.label}
            </button>
          </div>
          <button
            type="button"
            class="rounded px-1 text-[10px] leading-none font-medium {pinnedIds.includes(item.id)
              ? 'text-emerald-500 hover:text-emerald-400 dark:text-emerald-400 dark:hover:text-emerald-300'
              : 'text-gray-700 hover:text-gray-900 dark:text-white/75 dark:hover:text-primary-200'}"
            aria-label="Pin or unpin {item.label}"
            onclick={() => togglePin(item.id)}
          >
            {pinnedIds.includes(item.id) ? "★" : "☆"}
          </button>
        </div>
      {:else if item.kind === "plugin"}
        <div
          class="flex max-w-full items-center gap-1"
        >
          <div
            class="inline-flex min-w-0 flex-1 select-none items-center gap-1 rounded-md border border-gray-400/60 bg-gray-300/95 px-1 py-1 text-xs font-medium text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:shadow-none"
            data-palette-drag-plugin-id={item.id}
            ondragstartcapture={onPaletteDragStartCapture}
            use:draggable={{
              dragData: palettePluginPayload(item.id),
              container: palettePluginContainer(item.id),
              handle: PALETTE_CHIP_DRAG,
              attributes: paletteDragAttrs,
              callbacks: palettePluginDragCallbacks(item.id),
            }}
          >
            <button
              type="button"
              tabindex="0"
              class="flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm hover:bg-gray-400/45 focus:ring-2 focus:ring-primary-500 focus:outline-none active:cursor-grabbing dark:hover:bg-gray-600/90"
              data-testid="palette-chip-drag"
              data-palette-drag-plugin-id={item.id}
              aria-label="Drag {item.label} onto the dashboard"
              onpointerdown={(e) => {
                rememberPointer(e);
                preparePluginDragImage(item.id);
              }}
              ondragstart={(e) => onPluginDragStart(e, item.id)}
              ondragend={clearDragImage}
            >
              <GripVertical class="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              tabindex="0"
              class="min-w-0 flex-1 cursor-pointer rounded-sm px-1 py-0.5 text-left hover:bg-gray-400/45 focus:ring-2 focus:ring-primary-500 focus:outline-none dark:hover:bg-gray-600/85"
              aria-label="Add {item.label}"
              data-testid="palette-plugin-{item.id}"
              onkeydown={(e) => onChipKeydown(e, item)}
              onclick={() => onChipClick(item)}
            >
              {item.label}
            </button>
          </div>
          <button
            type="button"
            class="rounded px-1 text-[10px] leading-none font-medium {pinnedIds.includes(item.id)
              ? 'text-emerald-500 hover:text-emerald-400 dark:text-emerald-400 dark:hover:text-emerald-300'
              : 'text-gray-700 hover:text-gray-900 dark:text-white/75 dark:hover:text-primary-200'}"
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

{#if dragImageTile && gateway}
  <div
    class="pointer-events-none fixed left-0 top-0 z-[120]"
    bind:this={dragGhostEl}
    style="width: {Math.max(160, Math.min(760, (dragImageTile.grid?.colSpan ?? 1) * 56))}px; height: {Math.max(84, (dragImageTile.grid?.rowSpan ?? 1) * 72)}px; transform: translate(-10000px, -10000px);"
    aria-hidden="true"
  >
    <div class="h-full w-full overflow-hidden rounded-md border border-primary-500/65 bg-white shadow-lg dark:bg-gray-900">
      <PluginTileMount {gateway} tile={dragImageTile} {plugins} editLayout={false} />
    </div>
  </div>
{/if}
