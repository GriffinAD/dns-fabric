<script lang="ts">
  import Select from "flowbite-svelte/Select.svelte";

  import {
    type ColorPreset,
    type ThemeMode,
    applyDocumentTheme,
    getSystemPrefersDark,
    loadThemePreferences,
    saveThemePreferences,
  } from "./themeStorage";

  let { showAccent = true, showGaugeSegmentToggle = false }: { showAccent?: boolean; showGaugeSegmentToggle?: boolean } =
    $props();

  const appearanceItems: { value: ThemeMode; name: string }[] = [
    { value: "system", name: "System" },
    { value: "light", name: "Light" },
    { value: "dark", name: "Dark" },
  ];

  const accentItems: { value: ColorPreset; name: string }[] = [
    { value: "default", name: "Default (blue)" },
    { value: "emerald", name: "Emerald" },
    { value: "gray", name: "Gray" },
  ];

  const initial = loadThemePreferences();
  let mode = $state<ThemeMode>(initial.mode);
  let colorPreset = $state<ColorPreset>(initial.colorPreset);
  let gaugeSegmentEnabled = $state(initial.gaugeSegmentEnabled);
  let gaugeSegmentDivisions = $state(initial.gaugeSegmentDivisions);

  const segmentedArc = $derived(gaugeSegmentEnabled);

  /** Re-sync from storage when the document theme updates (e.g. Admin), so effective 0 in DOM does not clobber the stored block count. */
  $effect(() => {
    /* v8 ignore next 2 -- SSR: no `document` */
    if (typeof document === "undefined") return;
    const applyFromStorage = () => {
      const p = loadThemePreferences();
      gaugeSegmentDivisions = p.gaugeSegmentDivisions;
      gaugeSegmentEnabled = p.gaugeSegmentEnabled;
    };
    applyFromStorage();
    const root = document.documentElement;
    const mo = new MutationObserver(applyFromStorage);
    mo.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-gauge-segment-divisions",
        "data-gauge-segment-enabled",
        "data-gauge-segment-gap",
      ],
    });
    return () => mo.disconnect();
  });

  function commit() {
    const cur = loadThemePreferences();
    saveThemePreferences({
      version: 1,
      mode,
      colorPreset,
      gaugeCapStyle: cur.gaugeCapStyle,
      gaugeSegmentEnabled,
      gaugeSegmentDivisions,
      gaugeSegmentGapPx: cur.gaugeSegmentGapPx,
    });
    applyDocumentTheme(
      mode,
      colorPreset,
      getSystemPrefersDark(),
      cur.gaugeCapStyle,
      gaugeSegmentEnabled,
      gaugeSegmentDivisions,
      cur.gaugeSegmentGapPx,
    );
  }

  function onSegmentedArcToggle(checked: boolean) {
    gaugeSegmentEnabled = checked;
    commit();
  }
</script>

<div
  class="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4"
  data-testid="theme-controls"
  aria-label="Theme"
>
  <div class="min-w-0 sm:w-40">
    <label
      for="theme-appearance"
      class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      Appearance
    </label>
    <Select
      id="theme-appearance"
      class="w-full"
      bind:value={mode}
      placeholder=""
      items={appearanceItems}
      onchange={commit}
    />
  </div>
  {#if showAccent}
    <div class="min-w-0 sm:w-40">
      <label
        for="theme-accent"
        class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Accent
      </label>
      <Select
        id="theme-accent"
        class="w-full"
        bind:value={colorPreset}
        placeholder=""
        items={accentItems}
        onchange={commit}
      />
    </div>
  {/if}
  {#if showGaugeSegmentToggle}
    <div class="min-w-0 sm:w-56">
      <label
        class="mb-1 flex cursor-pointer items-center gap-2 text-sm text-gray-700 select-none dark:text-gray-300"
        for="theme-gauge-arc-segments"
      >
        <input
          id="theme-gauge-arc-segments"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-primary-600"
          checked={segmentedArc}
          onchange={(e) => onSegmentedArcToggle((e.currentTarget as HTMLInputElement).checked)}
          data-testid="header-gauge-arc-segments-toggle"
        />
        <span>Gauge arc segments</span>
      </label>
    </div>
  {/if}
</div>
