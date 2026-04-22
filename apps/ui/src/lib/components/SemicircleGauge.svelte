<script lang="ts">
  import { describeSemicircleArc, describeSemicircleProgress } from "./gaugeMath";

  let {
    label,
    percent,
    sublabel,
    compact = false,
  }: {
    label: string;
    percent: number;
    sublabel?: string;
    compact?: boolean;
  } = $props();

  const w = $derived(compact ? 120 : 160);
  const h = $derived(compact ? 70 : 90);
  const cx = $derived(w / 2);
  const cy = $derived(h - 8);
  const r = $derived(compact ? 48 : 64);

  const track = $derived(describeSemicircleArc(cx, cy, r));
  const arc = $derived(describeSemicircleProgress(cx, cy, r, percent));
</script>

<div class="flex flex-col items-center gap-1" data-testid="semicircle-gauge">
  <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
    <path d={track} fill="none" stroke="currentColor" class="text-gray-200 dark:text-gray-700" stroke-width="8" stroke-linecap="round" />
    <path d={arc} fill="none" stroke="currentColor" class="text-primary-600 dark:text-primary-400" stroke-width="8" stroke-linecap="round" />
  </svg>
  <span class="font-mono text-sm text-gray-900 dark:text-white">{percent.toFixed(1)}%</span>
  {#if sublabel}
    <span class="text-xs text-gray-500 dark:text-gray-400">{sublabel}</span>
  {/if}
</div>
