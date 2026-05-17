import { normalizeLayoutStrict } from "./layoutNormalize";
import { parseDashboardLayout } from "./layoutStorage";
import { ensureLayoutV3 } from "./migration";
import type { DashboardLayoutV3 } from "./types";

export type LayoutImportResult =
  | { ok: true; layout: DashboardLayoutV3 }
  | { ok: false; message: string };

/** Import always replaces the full dashboard layout (D2). */
export function importDashboardLayoutFromJson(raw: string): LayoutImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "File is not valid JSON." };
  }
  const layout = parseDashboardLayout(parsed);
  if (!layout) {
    return { ok: false, message: "Layout failed validation (version, grid, or plugin options)." };
  }
  try {
    const v3 = ensureLayoutV3(layout);
    const normalized = normalizeLayoutStrict(v3, false);
    return { ok: true, layout: normalized };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
