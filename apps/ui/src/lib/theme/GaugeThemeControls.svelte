<script lang="ts">
  import Select from "flowbite-svelte/Select.svelte";

  import {
    type GaugeCapStyle,
    applyDocumentTheme,
    clampGaugeSegmentDivisions,
    clampGaugeSegmentGap,
    GAUGE_SEGMENT_DIVISIONS_MAX,
    getSystemPrefersDark,
    loadThemePreferences,
    saveThemePreferences,
  } from "./themeStorage";

  const gaugeCapItems: { value: GaugeCapStyle; name: string }[] = [
    { value: "flat", name: "Flat (butt)" },
    { value: "rounded", name: "Round caps" },
  ];

  const initial = loadThemePreferences();
  let gaugeCapStyle = $state<GaugeCapStyle>(initial.gaugeCapStyle);
  let gaugeSegmentEnabled = $state(initial.gaugeSegmentEnabled);
  let gaugeSegmentDivisions = $state(initial.gaugeSegmentDivisions);
  let gaugeSegmentGapPx = $state(initial.gaugeSegmentGapPx);

  const segmentedArc = $derived(gaugeSegmentEnabled);

  const segmentCountLabel = $derived(
    `Segment Count (0-${GAUGE_SEGMENT_DIVISIONS_MAX}): ${gaugeSegmentDivisions}`,
  );

  function commit() {
    const gap = clampGaugeSegmentGap(Number(gaugeSegmentGapPx));
    gaugeSegmentGapPx = gap;
    const divisions = clampGaugeSegmentDivisions(Number(gaugeSegmentDivisions));
    gaugeSegmentDivisions = divisions;
    const cur = loadThemePreferences();
    saveThemePreferences({
      version: 1,
      mode: cur.mode,
      colorPreset: cur.colorPreset,
      gaugeCapStyle,
      gaugeSegmentEnabled,
      gaugeSegmentDivisions: divisions,
      gaugeSegmentGapPx: gap,
    });
    applyDocumentTheme(
      cur.mode,
      cur.colorPreset,
      getSystemPrefersDark(),
      gaugeCapStyle,
      gaugeSegmentEnabled,
      divisions,
      gap,
    );
  }

  function onSegmentedArcToggle(checked: boolean) {
    gaugeSegmentEnabled = checked;
    const cur = loadThemePreferences();
    saveThemePreferences({
      version: 1,
      mode: cur.mode,
      colorPreset: cur.colorPreset,
      gaugeCapStyle,
      gaugeSegmentEnabled: checked,
      gaugeSegmentDivisions: gaugeSegmentDivisions,
      gaugeSegmentGapPx: gaugeSegmentGapPx,
    });
    applyDocumentTheme(
      cur.mode,
      cur.colorPreset,
      getSystemPrefersDark(),
      gaugeCapStyle,
      checked,
      gaugeSegmentDivisions,
      gaugeSegmentGapPx,
    );
  }
</script>

<div
  class="flex w-full min-w-0 max-w-full flex-col gap-4"
  data-testid="gauge-theme-controls"
  aria-label="Gauge appearance"
>
  <div class="w-full min-w-0">
    <label
      for="admin-gauge-caps"
      class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      Gauge end caps
    </label>
    <Select
      id="admin-gauge-caps"
      class="w-full"
      bind:value={gaugeCapStyle}
      placeholder=""
      items={gaugeCapItems}
      onchange={commit}
    />
  </div>
  <div class="w-full min-w-0">
    <label
      class="mb-2 flex cursor-pointer items-center gap-2 text-sm text-gray-700 select-none dark:text-gray-300"
    >
      <input
        type="checkbox"
        class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-primary-600"
        checked={segmentedArc}
        onchange={(e) => onSegmentedArcToggle((e.currentTarget as HTMLInputElement).checked)}
        data-testid="gauge-arc-segments-toggle"
      />
      <span>Segments (along arc)</span>
    </label>
    <label
      for="admin-gauge-segment-divisions"
      class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      {segmentCountLabel}
    </label>
    <p class="mb-1 text-xs text-gray-500 dark:text-gray-400">
      0 uses the default count (20) when Segments (along arc) is on.
    </p>
    <input
      id="admin-gauge-segment-divisions"
      type="range"
      min={0}
      max={GAUGE_SEGMENT_DIVISIONS_MAX}
      step={1}
      bind:value={gaugeSegmentDivisions}
      onchange={commit}
      class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary-600 dark:bg-gray-700"
    />
    <label
      for="admin-gauge-segment-gap"
      class="mb-1 mt-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      Segment Gap Width (0-1): {gaugeSegmentGapPx.toFixed(2)}
    </label>
    <input
      id="admin-gauge-segment-gap"
      type="range"
      min={0}
      max={1}
      step={0.01}
      bind:value={gaugeSegmentGapPx}
      onchange={commit}
      class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary-600 dark:bg-gray-700"
    />
  </div>
</div>
