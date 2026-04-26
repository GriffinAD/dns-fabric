/**
 * Central feature flags for dashboard / shell experiments.
 * Defaults are off until a phase wires behaviour behind a flag.
 */
export type UiFeatureFlagName = "ui.palette.v2" | "ui.drag.enhanced" | "ui.registry.v2";

const DEFAULTS: Record<UiFeatureFlagName, boolean> = {
  /** On the `plugin` branch the new palette ships by default; override with `VITE_UI_PALETTE_V2=false`. */
  "ui.palette.v2": true,
  "ui.drag.enhanced": false,
  "ui.registry.v2": false,
};

function readEnvFlag(name: UiFeatureFlagName): boolean | undefined {
  const env = import.meta.env;
  if (env == null) return undefined;
  const key = `VITE_${name.replace(/\./g, "_").toUpperCase()}`;
  const raw = (env as Record<string, string | boolean | undefined>)[key];
  if (raw === "true" || raw === true) return true;
  if (raw === "false" || raw === false) return false;
  return undefined;
}

/** Resolved flag value (env override wins when set). */
export function getFeatureFlag(name: UiFeatureFlagName): boolean {
  return readEnvFlag(name) ?? DEFAULTS[name];
}
