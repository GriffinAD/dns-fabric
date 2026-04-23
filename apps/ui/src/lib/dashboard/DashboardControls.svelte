<script lang="ts">
  import Input from "flowbite-svelte/Input.svelte";

  import {
    applyDocumentDashboardSettings,
    clampGapPx,
    DASHBOARD_GAP_MAX_PX,
    DASHBOARD_GAP_MIN_PX,
    loadDashboardSettings,
    saveDashboardSettings,
  } from "./dashboardSettings";

  const initial = loadDashboardSettings();
  let gapPx = $state<number>(initial.gapPx);

  function commit() {
    const clamped = clampGapPx(gapPx);
    if (clamped !== gapPx) gapPx = clamped;
    const next = { version: 1 as const, gapPx: clamped };
    saveDashboardSettings(next);
    applyDocumentDashboardSettings(next);
  }
</script>

<div
  class="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4"
  data-testid="dashboard-controls"
  aria-label="Dashboard layout"
>
  <div class="min-w-0 sm:w-32">
    <label
      for="dashboard-gap"
      class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      Padding (px)
    </label>
    <Input
      id="dashboard-gap"
      type="number"
      min={DASHBOARD_GAP_MIN_PX}
      max={DASHBOARD_GAP_MAX_PX}
      step={1}
      class="w-full"
      bind:value={gapPx}
      onchange={commit}
      onblur={commit}
    />
  </div>
</div>
