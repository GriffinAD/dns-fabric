/** Session-only API token for control-plane mutations (never layout storage). */

const STORAGE_KEY = "pihole-cp-api-token";

export function readPiholeCpApiToken(): string {
  const fromEnv =
    typeof import.meta.env.VITE_PIHOLE_CP_API_TOKEN === "string"
      ? import.meta.env.VITE_PIHOLE_CP_API_TOKEN.trim()
      : "";
  if (fromEnv.length > 0) return fromEnv;
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writePiholeCpApiToken(token: string): void {
  try {
    const t = token.trim();
    if (t.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, t);
    }
  } catch {
    /* ignore quota / private mode */
  }
}
