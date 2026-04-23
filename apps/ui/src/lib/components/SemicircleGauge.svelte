<script lang="ts">
  import { describeSemicircleArc, describeSemicircleSegment } from "./gaugeMath";
  import { gaugeArcSegmentsForFill } from "./gaugeThresholds";

  let {
    label = undefined,
    /** In-card title already names the tile; show the top label row with no text (single gauge). */
    labelBlank = false,
    percent,
    sublabel,
    compact = false,
    mini = false,
    miniFillCell = false,
  }: {
    label?: string;
    labelBlank?: boolean;
    percent: number;
    sublabel?: string;
    compact?: boolean;
    mini?: boolean;
    miniFillCell?: boolean;
  } = $props();

  /** Slightly looser in default/compact; perf `mini` tiles share vertical space in one grid row. */
  const divider = $derived(
    mini
      ? "border-b border-gray-200 pb-0.5 mb-0.5 dark:border-gray-600"
      : "border-b border-gray-200 pb-1.5 mb-1.5 dark:border-gray-600",
  );

  const w = $derived(mini ? 76 : compact ? 120 : 160);
  const h = $derived(mini ? 46 : compact ? 70 : 90);
  const cx = $derived(w / 2);
  const cy = $derived(h - (mini ? 6 : 8));
  const r = $derived(mini ? 30 : compact ? 48 : 64);
  const stroke = $derived(mini ? 5 : 8);

  const safePercent = $derived.by(() => {
    const n = Number(percent);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  });

  const track = $derived(describeSemicircleArc(cx, cy, r));
  const progressSegments = $derived(
    gaugeArcSegmentsForFill(safePercent).map((seg) => ({
      d: describeSemicircleSegment(cx, cy, r, seg.t0, seg.t1),
      className: seg.className,
    })),
  );
  const showProgress = $derived(progressSegments.length > 0);
</script>

<div
  class="flex flex-col items-stretch {mini && miniFillCell
    ? 'h-full min-h-0 w-full min-w-0'
    : mini
      ? 'w-full min-w-0 max-w-[4.75rem] justify-self-center'
      : ''} gap-0"
  data-testid="semicircle-gauge"
  aria-label={label && !labelBlank ? undefined : `Gauge ${safePercent.toFixed(1)} percent`}
>
  {#if labelBlank || label}
    <div
      class="w-full shrink-0 text-center {divider}"
      aria-hidden={labelBlank ? "true" : undefined}
    >
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
  <div
    class="flex shrink-0 justify-center {mini
      ? 'w-full min-w-0 max-w-full overflow-hidden'
      : ''}"
  >
    <svg
      class="block [shape-rendering:geometricPrecision] {mini
        ? 'h-auto w-full max-w-full overflow-hidden'
        : 'overflow-visible'}"
      width={mini ? undefined : w}
      height={mini ? undefined : h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={mini ? "xMidYMax meet" : undefined}
      aria-hidden="true"
    >
      <path
        d={track}
        pathLength="100"
        fill="none"
        class="stroke-gray-300 dark:stroke-gray-600"
        stroke-width={stroke}
        stroke-linecap="round"
      />
      {#if showProgress}
        {#each progressSegments as seg (seg.d)}
          <path
            d={seg.d}
            fill="none"
            class={seg.className}
            stroke-width={stroke}
            stroke-linecap="round"
          />
        {/each}
      {/if}
    </svg>
  </div>
  <div class="w-full shrink-0 text-center {divider}">
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
