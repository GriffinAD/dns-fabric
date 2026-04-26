import { get, writable } from "svelte/store";

const STORAGE_KEY = "kea-fabric-palette-display";

export type PaletteDisplaySettings = {
  /** When true, chrome uses translucent fill + backdrop blur (glass). */
  transparency: boolean;
  /** When true, outer shell uses drop shadow (float depth). */
  dropShadow: boolean;
};

const DEFAULT: PaletteDisplaySettings = {
  transparency: true,
  dropShadow: true,
};

function parse(raw: string | null): PaletteDisplaySettings {
  if (!raw) return { ...DEFAULT };
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return { ...DEFAULT };
    const transparency =
      typeof (v as { transparency?: unknown }).transparency === "boolean"
        ? (v as { transparency: boolean }).transparency
        : DEFAULT.transparency;
    const dropShadow =
      typeof (v as { dropShadow?: unknown }).dropShadow === "boolean"
        ? (v as { dropShadow: boolean }).dropShadow
        : DEFAULT.dropShadow;
    return { transparency, dropShadow };
  } catch {
    return { ...DEFAULT };
  }
}

function hasUsableLocalStorage(): boolean {
  return (
    typeof localStorage !== "undefined" &&
    typeof localStorage.getItem === "function" &&
    typeof localStorage.setItem === "function"
  );
}

function load(): PaletteDisplaySettings {
  if (!hasUsableLocalStorage()) return { ...DEFAULT };
  return parse(localStorage.getItem(STORAGE_KEY));
}

function save(s: PaletteDisplaySettings): void {
  if (!hasUsableLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Reactive store; persists to `localStorage` under `kea-fabric-palette-display`. */
export const paletteDisplaySettings = writable<PaletteDisplaySettings>(load());

paletteDisplaySettings.subscribe((s) => {
  save(s);
});

/** Snapshot for non-Svelte callers (tests, future admin API). */
export function getPaletteDisplaySettings(): PaletteDisplaySettings {
  return get(paletteDisplaySettings);
}

export function setPaletteTransparency(value: boolean): void {
  paletteDisplaySettings.update((s) => ({ ...s, transparency: value }));
}

export function setPaletteDropShadow(value: boolean): void {
  paletteDisplaySettings.update((s) => ({ ...s, dropShadow: value }));
}

export function resetPaletteDisplaySettings(): void {
  paletteDisplaySettings.set({ ...DEFAULT });
}

/** Re-read `localStorage` into the store (e.g. after tests seed invalid JSON). */
export function reloadPaletteDisplaySettingsFromStorage(): void {
  paletteDisplaySettings.set(load());
}
