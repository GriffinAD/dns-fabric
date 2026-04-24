<script lang="ts">
  /** Monospace metric lines for `display_style: "percent_only"` tiles (`docs/planning/UI_ENGINE_PLAN.md` P5.6). */
  let {
    lines,
    class: className = "space-y-0.5 font-mono text-xs text-gray-800 dark:text-gray-200",
  }: {
    lines: string[];
    class?: string;
  } = $props();
</script>

<ul class={className} data-testid="metric-list">
  {#each lines as line, i (i)}
    <li>{line}</li>
  {/each}
</ul>
