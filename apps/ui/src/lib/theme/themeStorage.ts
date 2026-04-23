import { z } from "zod";

const STORAGE_KEY = "kea-fabric-ui-theme";

export const colorPresetSchema = z.enum(["default", "emerald"]);
export const themeModeSchema = z.enum(["light", "dark", "system"]);

const themePreferencesSchema = z.object({
  version: z.literal(1),
  mode: themeModeSchema,
  colorPreset: colorPresetSchema,
});

export type ThemePreferences = z.infer<typeof themePreferencesSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type ColorPreset = z.infer<typeof colorPresetSchema>;

const DEFAULT_PREFERENCES: ThemePreferences = {
  version: 1,
  mode: "system",
  colorPreset: "default",
};

export function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getEffectiveIsDark(mode: ThemeMode, prefersDark: boolean): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return prefersDark;
}

export function loadThemePreferences(): ThemePreferences {
  if (typeof localStorage === "undefined") {
    return DEFAULT_PREFERENCES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = themePreferencesSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveThemePreferences(p: ThemePreferences): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/**
 * Set `class="dark"` on the document element when the effective appearance is dark.
 * Set `data-color-preset` for Flowbite primary palette overrides in app.css.
 */
export function applyDocumentTheme(
  mode: ThemeMode,
  colorPreset: ColorPreset,
  prefersDark: boolean,
): { effectiveIsDark: boolean } {
  const effectiveIsDark = getEffectiveIsDark(mode, prefersDark);
  const root = document.documentElement;
  if (effectiveIsDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.colorPreset = colorPreset;
  return { effectiveIsDark };
}

export function resyncDocumentThemeFromStorage(): void {
  const p = loadThemePreferences();
  applyDocumentTheme(p.mode, p.colorPreset, getSystemPrefersDark());
}
