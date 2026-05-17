<script lang="ts">
  import { clampGridColSpan } from "../../plugins/core/builtinMeta";

  let {
    colSpan,
    maxTracks = 20,
    minColSpan = 1,
    trackCount = 20,
    onColSpanChange,
  }: {
    colSpan: number;
    /** Max span for this grid (root = 20, group inner = container width). */
    maxTracks?: number;
    minColSpan?: number;
    /** Column count on the parent grid element used to measure track width. */
    trackCount?: number;
    onColSpanChange: (colSpan: number, phase: "preview" | "commit") => void;
  } = $props();

  let dragging = $state(false);
  let startX = 0;
  let startSpan = 1;
  let trackPx = 1;

  function measureTrackPx(el: HTMLElement): number {
    const grid = el.closest(
      '[data-dashboard-editor="drop-zone"], [data-dashboard-tile-grid], [data-dashboard-editor="group-inner-grid"]',
    );
    if (!grid) return 24;
    const rect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const gap =
      parseFloat(style.columnGap || "0") ||
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dashboard-gap")) ||
      0;
    const attrTracks = grid.getAttribute("data-group-inner-tracks");
    const tracks = Math.max(
      1,
      attrTracks != null && attrTracks !== "" ? Number(attrTracks) : trackCount,
    );
    return (rect.width - gap * Math.max(0, tracks - 1)) / tracks;
  }

  function spanFromDelta(deltaPx: number): number {
    const deltaCols = Math.round(deltaPx / Math.max(1, trackPx));
    return clampGridColSpan(Math.max(minColSpan, Math.min(maxTracks, startSpan + deltaCols)));
  }

  function capturePointer(btn: HTMLButtonElement, pointerId: number) {
    if (typeof btn.setPointerCapture === "function") btn.setPointerCapture(pointerId);
  }

  function releasePointer(btn: HTMLButtonElement, pointerId: number) {
    if (typeof btn.hasPointerCapture === "function" && btn.hasPointerCapture(pointerId)) {
      btn.releasePointerCapture(pointerId);
    }
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    startX = e.clientX;
    startSpan = colSpan;
    trackPx = measureTrackPx(btn);
    dragging = true;
    capturePointer(btn, e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const next = spanFromDelta(e.clientX - startX);
    if (next !== colSpan) onColSpanChange(next, "preview");
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = false;
    const btn = e.currentTarget as HTMLButtonElement;
    releasePointer(btn, e.pointerId);
    onColSpanChange(spanFromDelta(e.clientX - startX), "commit");
  }
</script>

<button
  type="button"
  class="editor-tile-col-resize pointer-events-none absolute right-0 bottom-0 z-[55] flex h-4 w-4 cursor-se-resize touch-none items-center justify-center rounded-tl-md border border-slate-300/90 bg-slate-100/95 opacity-0 shadow-sm backdrop-blur-[1px] transition-opacity group-hover/editor-plugin:pointer-events-auto group-hover/editor-plugin:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500/60 active:cursor-se-resizing dark:border-gray-600 dark:bg-gray-900/90 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 {dragging
    ? 'pointer-events-auto opacity-100'
    : ''}"
  aria-label="Resize tile width (columns)"
  title="Drag to change width in grid columns"
  data-testid="editor-tile-col-resize-handle"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
>
  <span
    class="block h-2 w-2 rounded-br-sm border-r-2 border-b-2 border-slate-500 dark:border-gray-400"
    aria-hidden="true"
  ></span>
</button>
