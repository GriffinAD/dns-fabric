<script lang="ts">
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";

  import type { GaugeGradientMode } from "../api/types";
  import type { GaugeCapStyle } from "../theme/themeStorage";
  import {
    DEFAULT_GAUGE_SEGMENT_DIVISIONS,
    DEFAULT_GAUGE_SEGMENT_GAP,
    effectiveGaugeSegmentDivisionsFromDataAttrs,
    clampGaugeSegmentGap,
  } from "../theme/themeStorage";
  import {
    clampGaugePercent,
    gaugeDisplayTweenDuration,
    prefersReducedMotion,
  } from "./gaugeDisplay";
  import { describeSemicircleArc, describeSemicircleSegment, semicirclePoint } from "./gaugeMath";
  import {
    GAUGE_ARC_ZONE_STOPS,
    gaugeArcSegmentsForFill,
    gaugeBandedStrokeClassAtArcT,
    gaugeFillHexAtArcT,
  } from "./gaugeThresholds";

  const SVG_SURFACE_FX =
    "transform: translateZ(0); -webkit-backface-visibility: hidden; backface-visibility: hidden";
  const smoothGradientId = `gauge-smooth-${Math.random().toString(36).slice(2)}`;
  const SMOOTH_ZONE_BREAKS = [
    0,
    GAUGE_ARC_ZONE_STOPS.u70,
    GAUGE_ARC_ZONE_STOPS.u80,
    GAUGE_ARC_ZONE_STOPS.u90,
    1,
  ] as const;

  function gaugeCapStyleFromDataset(root: HTMLElement): GaugeCapStyle {
    return root.dataset.gaugeCapStyle === "rounded" ? "rounded" : "flat";
  }

  function gaugeSegmentGapFromDataset(root: HTMLElement): number {
    const raw = root.dataset.gaugeSegmentGap ?? root.dataset.gaugeSegmentGapPx;
    return clampGaugeSegmentGap(Number(raw));
  }

  let {
    label = undefined,
    /** In-card title already names the tile; show the top label row with no text (single gauge). */
    labelBlank = false,
    percent,
    sublabel,
    compact = false,
    /** Larger canvas for e.g. admin “live preview” (does not imply `mini` tile layout). */
    preview = false,
    mini = false,
    miniFillCell = false,
    /** `smooth`: gradient between threshold colours; `banded`: solid segments per zone. */
    gradientMode = "smooth",
  }: {
    label?: string;
    labelBlank?: boolean;
    percent: number;
    sublabel?: string;
    compact?: boolean;
    preview?: boolean;
    mini?: boolean;
    miniFillCell?: boolean;
    gradientMode?: GaugeGradientMode;
  } = $props();

  let gaugeCapStyle = $state<GaugeCapStyle>("flat");
  let gaugeSegmentDivisions = $state(DEFAULT_GAUGE_SEGMENT_DIVISIONS);
  let gaugeSegmentGapNorm = $state(DEFAULT_GAUGE_SEGMENT_GAP);
  /** Matches `.dark` on `documentElement` so smooth fills use the same hex scale as `gaugeFillHexAtArcT`. */
  let documentIsDark = $state(false);
  $effect(() => {
    /* c8 ignore next 2 */
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const sync = () => {
      gaugeCapStyle = gaugeCapStyleFromDataset(root);
      gaugeSegmentDivisions = effectiveGaugeSegmentDivisionsFromDataAttrs(root);
      gaugeSegmentGapNorm = gaugeSegmentGapFromDataset(root);
      documentIsDark = root.classList.contains("dark");
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, {
      attributes: true,
      attributeFilter: [
        "class",
        "data-gauge-cap-style",
        "data-gauge-segment-enabled",
        "data-gauge-segment-divisions",
        "data-gauge-segment-lines",
        "data-gauge-segment-gap",
        "data-gauge-segment-gap-px",
      ],
    });
    return () => mo.disconnect();
  });

  /** Global theme: SVG `stroke-linecap` round vs butt. */
  const strokeLinecap = $derived(gaugeCapStyle === "rounded" ? "round" : "butt");

  /** Slightly looser in default/compact; perf `mini` tiles share vertical space in one grid row. */
  const divider = $derived(
    mini
      ? "border-b border-slate-200/90 pb-0.5 mb-0.5 dark:border-gray-600"
      : "border-b border-slate-200/90 pb-1.5 mb-1.5 dark:border-gray-600",
  );
  const labelRowClass = $derived(`w-full shrink-0 text-center ${divider}`);
  const readoutRowClass = $derived(`w-full shrink-0 text-center ${divider}`);

  const w = $derived(mini ? 76 : preview ? 280 : compact ? 120 : 160);
  /** 240° arc needs ~1.5×r vertical span (top cy−r to endpoints cy+r/2). */
  const h = $derived(mini ? 52 : preview ? 176 : compact ? 78 : 100);
  /** Default track 16px; compact / mini scale down for layout. */
  const stroke = $derived(mini ? 8 : preview ? 28 : compact ? 12 : 20);
  /** Pad viewBox for stroke caps plus ~1px user-space margin so AA fringes are not clipped. */
  const vbPad = $derived((strokeLinecap === "round" ? stroke * 0.55 : stroke / 2) + 1);
  const vbW = $derived(w + 2 * vbPad);
  const vbH = $derived(h + 2 * vbPad);
  const svgSurfaceStyle = $derived(
    mini
      ? `aspect-ratio: ${vbW} / ${vbH}; width: 100%; height: auto; ${SVG_SURFACE_FX}`
      : SVG_SURFACE_FX,
  );
  const cx = $derived(w / 2);
  const r = $derived(mini ? 24 : preview ? 100 : compact ? 42 : 56);
  const bottomClear = $derived(
    r / 2 + stroke / 2 + (mini ? 5 : compact ? 6 : preview ? 10 : 8),
  );
  const cy = $derived(h - bottomClear + vbPad);

  const targetPercent = $derived(clampGaugePercent(Number(percent)));

  /** Animated readout + arc fill (slides between poll updates). */
  const displayPercent = tweened(targetPercent, { duration: 0 });

  let instantNextTween = true;

  $effect(() => {
    const duration = gaugeDisplayTweenDuration({
      reducedMotion: prefersReducedMotion(),
      instant: instantNextTween,
    });
    instantNextTween = false;
    void displayPercent.set(targetPercent, { duration, easing: cubicOut });
  });

  const safePercent = $derived(clampGaugePercent($displayPercent));

  const track = $derived(describeSemicircleArc(cx, cy, r));
  const progressSegments = $derived(
    gaugeArcSegmentsForFill(safePercent).map((seg) => ({
      d: describeSemicircleSegment(cx, cy, r, seg.t0, seg.t1),
      className: seg.className,
    })),
  );
  const showProgress = $derived(progressSegments.length > 0);
  const fillT = $derived(safePercent / 100);

  /** Discrete arc chunks (reference: separated blocks; gaps show the tile through the SVG). */
  const discreteArcCells = $derived.by(() => {
    const n = gaugeSegmentDivisions;
    /* c8 ignore next 2 */
    if (n <= 0) return [] as { t0: number; t1: number }[];
    const span = 1 / n;
    /**
     * `gapNorm` 0 = flush blocks; 1 = gap width ≈ one nominal segment (blocks become thin slivers).
     * Each cell loses `halfGap` on each side; inter-block gap in t is `2*halfGap`.
     */
    const g = Math.max(0, Math.min(1, gaugeSegmentGapNorm));
    const maxHalf = span * 0.5 - 1e-4 * Math.max(span, 1e-6);
    const halfGap = g * maxHalf;
    const cells: { t0: number; t1: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = i * span + halfGap;
      const b = (i + 1) * span - halfGap;
      if (b > a) cells.push({ t0: a, t1: b });
    }
    return cells;
  });

  /**
   * Block layout (N blocks + optional gaps): when arc segments are on, for **both** banded
   * and the default `smooth` tile mode. Previously only `banded` used this, so with
   * `gradientMode: "smooth"`, count/gap were ignored.
   */
  const useSegmentedBlockArc = $derived(
    (gradientMode === "banded" || gradientMode === "smooth") &&
      gaugeSegmentDivisions > 0 &&
      discreteArcCells.length > 0,
  );

  function discreteFillSlice(
    cellT0: number,
    cellT1: number,
    fillT: number,
  ): { ft0: number; ft1: number } | null {
    const ft0 = Math.max(cellT0, 0);
    const ft1 = Math.min(cellT1, fillT);
    if (ft1 > ft0) return { ft0, ft1 };
    return null;
  }

  function smoothFillSegment(t0: number, t1: number, key: string) {
    return {
      key,
      gradId: `${smoothGradientId}-${key}`,
      d: describeSemicircleSegment(cx, cy, r, t0, t1),
      start: semicirclePoint(cx, cy, r, t0),
      end: semicirclePoint(cx, cy, r, t1),
      color0: gaugeFillHexAtArcT(t0, documentIsDark),
      color1: gaugeFillHexAtArcT(t1, documentIsDark),
    };
  }

  function smoothFillSegmentsForRange(t0: number, t1: number, keyPrefix: string) {
    const out: ReturnType<typeof smoothFillSegment>[] = [];
    for (let i = 0; i < SMOOTH_ZONE_BREAKS.length - 1; i++) {
      const a = Math.max(t0, SMOOTH_ZONE_BREAKS[i]!);
      const b = Math.min(t1, SMOOTH_ZONE_BREAKS[i + 1]!);
      if (b > a) {
        out.push(smoothFillSegment(a, b, `${keyPrefix}-${i}`));
      }
      if (t1 <= SMOOTH_ZONE_BREAKS[i + 1]!) {
        break;
      }
    }
    return out;
  }

  const smoothFillSegments = $derived.by(() => {
    /* c8 ignore next 2 */
    if (fillT <= 0 || gradientMode !== "smooth")
      return [] as ReturnType<typeof smoothFillSegment>[];

    if (useSegmentedBlockArc) {
      return discreteArcCells.flatMap((cell, i) => {
        const slice = discreteFillSlice(cell.t0, cell.t1, fillT);
        return slice ? smoothFillSegmentsForRange(slice.ft0, slice.ft1, `cell-${i}`) : [];
      });
    }

    return smoothFillSegmentsForRange(0, fillT, "zone");
  });
</script>

<div
  class="flex flex-col items-stretch {mini && miniFillCell
    ? 'h-full min-h-0 w-full min-w-0'
    : mini
      ? 'w-full min-w-0 max-w-[4.75rem] justify-self-center'
      : ''} gap-0"
  data-testid="semicircle-gauge"
  aria-label={label && !labelBlank ? undefined : `Gauge ${targetPercent.toFixed(1)} percent`}
>
  {#if labelBlank || label}
    <div class={labelRowClass} aria-hidden={labelBlank ? "true" : undefined}>
      {#if labelBlank}
        <span
          class="block min-h-[1em] font-medium {mini
            ? miniFillCell
              ? 'w-full max-w-full text-[10px] uppercase tracking-wide'
              : 'max-w-[4.75rem] text-[10px] uppercase tracking-wide'
            : 'max-w-[5.5rem] text-xs'}"
          >&nbsp;</span
        >
      {:else}
        <span
          class="block truncate font-medium text-gray-600 dark:text-gray-300 {mini
            ? miniFillCell
              ? 'w-full max-w-full text-[10px] uppercase tracking-wide'
              : 'max-w-[4.75rem] text-[10px] uppercase tracking-wide'
            : 'max-w-[5.5rem] text-xs'}"
          >{label}</span
        >
      {/if}
    </div>
  {/if}
  <div class="flex shrink-0 justify-center {mini ? 'w-full min-w-0 max-w-full' : ''}">
    <div
      class="relative shrink-0 {mini ? 'w-full min-w-0 max-w-full' : 'inline-block'}"
      style:width={mini ? undefined : `${w}px`}
      style:height={mini ? undefined : `${h}px`}
      style:aspect-ratio={mini ? `${vbW} / ${vbH}` : undefined}
    >
      <svg
        class="relative z-0 block h-full w-full max-w-full overflow-hidden"
        style={svgSurfaceStyle}
        color-rendering="optimizeQuality"
        viewBox={`${-vbPad} ${-vbPad} ${vbW} ${vbH}`}
        preserveAspectRatio={mini ? "xMidYMax meet" : "xMidYMid meet"}
        aria-hidden="true"
      >
      {#if gradientMode === "smooth" && showProgress}
        <defs>
          {#each smoothFillSegments as seg (seg.key)}
            <linearGradient
              id={seg.gradId}
              gradientUnits="userSpaceOnUse"
              x1={seg.start.x}
              y1={seg.start.y}
              x2={seg.end.x}
              y2={seg.end.y}
            >
              <stop offset="0%" stop-color={seg.color0} />
              <stop offset="100%" stop-color={seg.color1} />
            </linearGradient>
          {/each}
        </defs>
      {/if}
      {#if useSegmentedBlockArc}
        {#each discreteArcCells as cell, i (`${cell.t0}-${cell.t1}`)}
          <path
            d={describeSemicircleSegment(cx, cy, r, cell.t0, cell.t1)}
            fill="none"
            stroke="var(--gauge-track-rest)"
            stroke-width={stroke}
            stroke-linecap={strokeLinecap}
            stroke-linejoin="round"
          />
        {/each}
        {#if showProgress && gradientMode === "banded"}
          {#each discreteArcCells as cell, i (`b-${cell.t0}-${cell.t1}`)}
            {@const slice = discreteFillSlice(cell.t0, cell.t1, fillT)}
            {#if slice}
              {@const bandClass = gaugeBandedStrokeClassAtArcT((slice.ft0 + slice.ft1) / 2)}
              <path
                d={describeSemicircleSegment(cx, cy, r, slice.ft0, slice.ft1)}
                fill="none"
                class={bandClass}
                stroke-width={stroke}
                stroke-linecap={strokeLinecap}
                stroke-linejoin="round"
              />
            {/if}
          {/each}
        {:else if showProgress && gradientMode === "smooth"}
          {#each smoothFillSegments as seg (seg.key)}
            <path
              d={seg.d}
              fill="none"
              stroke={`url(#${seg.gradId})`}
              stroke-width={stroke}
              stroke-linecap={strokeLinecap}
              stroke-linejoin="round"
            />
          {/each}
        {/if}
      {:else}
        <path
          d={track}
          pathLength="100"
          fill="none"
          stroke="var(--gauge-track-rest)"
          stroke-width={stroke}
          stroke-linecap={strokeLinecap}
          stroke-linejoin="round"
        />
        {#if showProgress && gradientMode === "banded"}
          {#each progressSegments as seg (seg.d)}
            <path
              d={seg.d}
              fill="none"
              class={seg.className}
              stroke-width={stroke}
              stroke-linecap={strokeLinecap}
              stroke-linejoin="round"
            />
          {/each}
        {:else if showProgress && gradientMode === "smooth"}
          {#each smoothFillSegments as seg (seg.key)}
            <path
              d={seg.d}
              fill="none"
              stroke={`url(#${seg.gradId})`}
              stroke-width={stroke}
              stroke-linecap={strokeLinecap}
              stroke-linejoin="round"
            />
          {/each}
        {/if}
      {/if}
    </svg>
    </div>
  </div>
  <div class={readoutRowClass}>
    <span class="font-mono text-gray-900 dark:text-white {mini ? 'text-xs' : 'text-sm'}"
      >{safePercent.toFixed(1)}%</span
    >
  </div>
  {#if mini}
    <!-- One line; fixed height so perf tiles in a row stay level (full text in title for hover) -->
    <div class="flex h-4 w-full min-w-0 max-w-full shrink-0 items-center justify-center">
      {#if sublabel}
        <p
          class="m-0 w-full min-w-0 truncate text-center text-[9px] leading-tight text-gray-500 dark:text-gray-400"
          title={sublabel}
        >
          {sublabel}
        </p>
      {:else}
        <p
          class="m-0 w-full min-w-0 truncate text-center text-[9px] leading-tight text-gray-500 opacity-0 dark:text-gray-400"
          aria-hidden="true"
        >
          &nbsp;
        </p>
      {/if}
    </div>
  {:else if sublabel}
    <p
      class="m-0 max-w-[6rem] self-center break-words text-center text-xs text-gray-500 dark:text-gray-400"
    >
      {sublabel}
    </p>
  {:else}
    <div class="w-full shrink-0 min-h-4" aria-hidden="true"></div>
  {/if}
</div>
