/** Minor line from control-plane API version (e.g. `0.4.0` → `0.4`). */
export function piholeCpApiMinorLine(apiVersion: string): string {
  const parts = apiVersion.trim().split(".");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0]}.${parts[1]}`;
  }
  return apiVersion.trim() || "0.4";
}

/**
 * Operator header version: `0.4.{build}` where `{build}` is stamped at embed build time
 * (`PIHOLE_CP_UI_BUILD` / UTC compact timestamp).
 */
export function formatPiholeCpUiDisplayVersion(
  apiVersion: string,
  uiBuild: string | undefined,
): string {
  const minor = piholeCpApiMinorLine(apiVersion);
  const build = (uiBuild?.trim() || "dev").replace(/^v/i, "");
  return `${minor}.${build}`;
}

export function readPiholeCpUiBuildFromEnv(): string | undefined {
  const raw = import.meta.env.VITE_PIHOLE_CP_UI_BUILD;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}
