<script lang="ts">
  import Select from "flowbite-svelte/Select.svelte";
  import Moon from "lucide-svelte/icons/moon";
  import Sun from "lucide-svelte/icons/sun";

  import {
    type ColorPreset,
    type ThemeMode,
    applyDocumentTheme,
    getSystemPrefersDark,
    loadThemePreferences,
    saveThemePreferences,
  } from "./themeStorage";

  let {
    showAccent = true,
    showGaugeSegmentToggle = false,
    toolbarRow = false,
  }: {
    showAccent?: boolean;
    showGaugeSegmentToggle?: boolean;
    toolbarRow?: boolean;
  } = $props();

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
  const effectiveIsDark = $derived(
    mode === "dark" ? true : mode === "light" ? false : getSystemPrefersDark(),
  );
  const appearanceToggleLabel = $derived(
    effectiveIsDark ? "Switch to light mode" : "Switch to dark mode",
  );

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

  function toggleAppearanceMode() {
    mode = effectiveIsDark ? "light" : "dark";
    commit();
  }
</script>

<div
  class="flex gap-2 {toolbarRow ? 'flex-row items-end' : 'flex-col sm:flex-row sm:items-end sm:gap-4'}"
  data-testid="theme-controls"
  aria-label="Theme"
>
  <div class="flex min-w-0 flex-col items-end sm:w-auto sm:self-end">
    <span class="sr-only">Appearance</span>
    <!-- Label-row height only (no wide invisible text — that was stretching the button to a pill). -->
    <span
      class="mb-1 hidden h-[1.125rem] w-0 max-w-0 shrink-0 overflow-hidden sm:block"
      aria-hidden="true"
    ></span>
    <button
      id="theme-appearance-toggle"
      type="button"
      data-ghost-icon-toggle
      style="border: none; box-shadow: none;"
      class="group inline-flex w-fit shrink-0 cursor-pointer items-center justify-center rounded-base bg-transparent p-2 text-heading ring-0 outline-none hover:bg-neutral-secondary-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-transparent dark:hover:bg-transparent dark:active:bg-transparent dark:focus-visible:ring-offset-gray-900"
      aria-label={appearanceToggleLabel}
      title={appearanceToggleLabel}
      data-testid="theme-appearance-toggle"
      onclick={toggleAppearanceMode}
    >
      {#if effectiveIsDark}
        <Sun
          class="h-5 w-5 shrink-0 stroke-2 opacity-90 transition-[stroke-width,opacity] duration-150 ease-out group-hover:stroke-[2.75] group-hover:opacity-100"
          aria-hidden="true"
        />
      {:else}
        <Moon
          class="h-5 w-5 shrink-0 stroke-2 opacity-90 transition-[stroke-width,opacity] duration-150 ease-out group-hover:stroke-[2.75] group-hover:opacity-100"
          aria-hidden="true"
        />
      {/if}
    </button>
  </div>
  {#if showAccent}
    <div class="min-w-0 sm:w-40">
      <label
        for="theme-accent"
        class="mb-1 block text-xs font-medium whitespace-nowrap text-gray-700 dark:text-gray-300"
      >
        Accent
      </label>
      <Select
        id="theme-accent"
        class="w-full"
        size="sm"
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
