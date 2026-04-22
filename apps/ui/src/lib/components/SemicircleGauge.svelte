<script lang="ts">
  import { describeSemicircleArc, describeSemicircleSegment } from "./gaugeMath";
  import { gaugeArcSegmentsForFill } from "./gaugeThresholds";

  const divider = "border-b border-gray-200 pb-1.5 mb-1.5 dark:border-gray-600";

  let {
    label = undefined,
    percent,
    sublabel,
    compact = false,
    mini = false,
    miniFillCell = false,
  }: {
    label?: string;
    percent: number;
    sublabel?: string;
    compact?: boolean;
    mini?: boolean;
    miniFillCell?: boolean;
  } = $props();

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
      ? 'w-auto max-w-[4.75rem] shrink-0'
      : ''} gap-0"
  data-testid="semicircle-gauge"
  aria-label={label ? undefined : `Gauge ${safePercent.toFixed(1)} percent`}
>
  {#if label}
    <div class="w-full shrink-0 text-center {divider}">
      <span
        class="block truncate font-medium text-gray-600 dark:text-gray-300 {mini
          ? miniFillCell
            ? 'w-full max-w-full text-[10px] uppercase tracking-wide'
            : 'max-w-[4.75rem] text-[10px] uppercase tracking-wide'
          : 'max-w-[5.5rem] text-xs'}"
        >{label}</span
      >
    </div>
  {:else if mini}
    <!-- e.g. RAM: card has h3 but no in-gauge label; reserve same top band as labeled mini gauges -->
    <div class="w-full shrink-0 {divider}" aria-hidden="true">
      <div class="h-[0.7rem] w-full"></div>
    </div>
  {/if}
  <div class="flex shrink-0 justify-center">
    <svg
      class="block overflow-visible [shape-rendering:geometricPrecision]"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
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
  {#if sublabel}
    <p
      class="m-0 max-w-[6rem] self-center break-words text-center text-gray-500 dark:text-gray-400 {mini
        ? 'text-[10px] leading-tight'
        : 'text-xs'}"
    >
      {sublabel}
    </p>
  {:else}
    <!-- One line: align tile height with gauges that show a sublabel -->
    <div
      class="w-full shrink-0 {mini ? 'min-h-[0.875rem]' : 'min-h-4'}"
      aria-hidden="true"
    ></div>
  {/if}
</div>
