<script lang="ts">
  import type { Snippet } from "svelte";

  /** Pass-through host for `hostControl: "single-panel"` (UI_ENGINE_SPEC §4.3). */
  let { children }: { children: Snippet } = $props();
</script>

<div class="contents min-h-0 min-w-0 flex flex-1 flex-col" data-host-control="single-panel">
  {@render children()}
</div>
