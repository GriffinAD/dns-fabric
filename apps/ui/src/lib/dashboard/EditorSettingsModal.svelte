<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import Input from "flowbite-svelte/Input.svelte";
  import Modal from "flowbite-svelte/Modal.svelte";
  import Select from "flowbite-svelte/Select.svelte";

  import {
    applyDocumentDashboardSettings,
    clampGapPx,
    DASHBOARD_GAP_MAX_PX,
    DASHBOARD_GAP_MIN_PX,
    loadDashboardSettings,
    saveDashboardSettings,
  } from "./dashboardSettings";
  import {
    type ColorPreset,
    applyDocumentTheme,
    getSystemPrefersDark,
    loadThemePreferences,
    saveThemePreferences,
  } from "../theme/themeStorage";

  let { open = $bindable(false) }: { open?: boolean } = $props();

  const accentItems: { value: ColorPreset; name: string }[] = [
    { value: "default", name: "Default (blue)" },
    { value: "emerald", name: "Emerald" },
    { value: "gray", name: "Gray" },
  ];

  const themeInitial = loadThemePreferences();
  const dashInitial = loadDashboardSettings();

  let colorPreset = $state<ColorPreset>(themeInitial.colorPreset);
  let gaugeSegmentEnabled = $state(themeInitial.gaugeSegmentEnabled);
  let gapPx = $state<number>(dashInitial.gapPx);

  const segmentedArc = $derived(gaugeSegmentEnabled);

  function commitTheme() {
    const cur = loadThemePreferences();
    saveThemePreferences({
      version: 1,
      mode: cur.mode,
      colorPreset,
      gaugeCapStyle: cur.gaugeCapStyle,
      gaugeSegmentEnabled,
      gaugeSegmentDivisions: cur.gaugeSegmentDivisions,
      gaugeSegmentGapPx: cur.gaugeSegmentGapPx,
    });
    applyDocumentTheme(
      cur.mode,
      colorPreset,
      getSystemPrefersDark(),
      cur.gaugeCapStyle,
      gaugeSegmentEnabled,
      cur.gaugeSegmentDivisions,
      cur.gaugeSegmentGapPx,
    );
  }

  function commitGap() {
    const clamped = clampGapPx(gapPx);
    if (clamped !== gapPx) gapPx = clamped;
    const next = { version: 1 as const, gapPx: clamped };
    saveDashboardSettings(next);
    applyDocumentDashboardSettings(next);
  }

  function onSegmentedArcToggle(checked: boolean) {
    gaugeSegmentEnabled = checked;
    commitTheme();
  }

  $effect(() => {
    if (open) {
      const t = loadThemePreferences();
      colorPreset = t.colorPreset;
      gaugeSegmentEnabled = t.gaugeSegmentEnabled;
      gapPx = loadDashboardSettings().gapPx;
    }
  });
</script>

<Modal bind:open title="Display settings" size="md" class="z-[100]">
  {#snippet children()}
    <div class="flex flex-col gap-4" data-testid="editor-display-settings-modal">
      <div>
        <label
          for="editor-settings-accent"
          class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Accent
        </label>
        <Select
          id="editor-settings-accent"
          class="w-full"
          size="sm"
          bind:value={colorPreset}
          placeholder=""
          items={accentItems}
          onchange={commitTheme}
        />
      </div>
      <label
        class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 select-none dark:text-gray-300"
        for="editor-settings-gauge-arc-segments"
      >
        <input
          id="editor-settings-gauge-arc-segments"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-primary-600"
          checked={segmentedArc}
          onchange={(e) => onSegmentedArcToggle((e.currentTarget as HTMLInputElement).checked)}
          data-testid="header-gauge-arc-segments-toggle"
        />
        <span>Gauge arc segments</span>
      </label>
      <div>
        <label
          for="editor-settings-dashboard-gap"
          class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Padding (px)
        </label>
        <Input
          id="editor-settings-dashboard-gap"
          type="number"
          size="sm"
          min={DASHBOARD_GAP_MIN_PX}
          max={DASHBOARD_GAP_MAX_PX}
          step={1}
          class="w-full"
          bind:value={gapPx}
          onchange={commitGap}
          onblur={commitGap}
        />
      </div>
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="flex w-full justify-end">
      <Button type="button" color="alternative" onclick={() => (open = false)}>Close</Button>
    </div>
  {/snippet}
</Modal>
