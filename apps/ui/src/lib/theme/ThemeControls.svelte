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

  const appearanceItems: { value: ThemeMode; name: string }[] = [
    { value: "system", name: "System" },
    { value: "light", name: "Light" },
    { value: "dark", name: "Dark" },
  ];

  const accentItems: { value: ColorPreset; name: string }[] = [
    { value: "default", name: "Default (blue)" },
    { value: "emerald", name: "Emerald" },
  ];

  const initial = loadThemePreferences();
  let mode = $state<ThemeMode>(initial.mode);
  let colorPreset = $state<ColorPreset>(initial.colorPreset);

  function commit() {
    saveThemePreferences({ version: 1, mode, colorPreset });
    applyDocumentTheme(mode, colorPreset, getSystemPrefersDark());
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
</div>
