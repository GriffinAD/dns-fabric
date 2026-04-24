<script lang="ts">
  import type { GaugeGradientMode } from "../../api/types";
  import type { DashboardTile } from "../../dashboard/types";

  let { draft = $bindable() }: { draft: DashboardTile } = $props();
</script>

{#if (draft.options?.display_style ?? "gauge") === "gauge"}
  <label class="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
    <span>Gauge colours</span>
    <select
      class="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      data-testid="tile-settings-gauge-gradient"
      value={draft.options?.gauge_gradient_mode ?? "smooth"}
      onchange={(e) => {
        const v = (e.currentTarget as HTMLSelectElement).value as GaugeGradientMode;
        draft = { ...draft, options: { ...draft.options, gauge_gradient_mode: v } };
      }}
    >
      <option value="smooth">Smooth gradient</option>
      <option value="banded">Banded</option>
    </select>
  </label>
{/if}
