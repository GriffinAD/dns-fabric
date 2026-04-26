import { ensureLayoutV2 } from "../migration";
import type { DashboardGroup, DashboardLayout, DashboardLayoutV2, RootLayoutItem, RootTileItem } from "../types";

/** Legacy dashboard tiles removed on load (see `docs/planning/UI_ENGINE_PLAN.md` P3.6). */
export const LEGACY_PERF_SUMMARY_PLUGIN_IDS = new Set(["perf.summary"]);

/**
 * Drops legacy `perf.summary` tiles from a layout (root and inside groups).
 * Behaviour preserved from former `withoutLegacyTiles` in `layoutStorage.ts`.
 */
export function stripLegacyPerfSummaryTiles(layout: DashboardLayout): DashboardLayoutV2 {
  const v2 = ensureLayoutV2(layout);
  const items: RootLayoutItem[] = [];
  for (const it of v2.items) {
    if (it.kind === "group") {
      const children = it.children.filter((c) => !LEGACY_PERF_SUMMARY_PLUGIN_IDS.has(c.pluginId));
      if (children.length === 0) continue;
      items.push({ ...it, children } satisfies DashboardGroup);
    } else {
      if (LEGACY_PERF_SUMMARY_PLUGIN_IDS.has(it.pluginId)) continue;
      items.push(it satisfies RootTileItem);
    }
  }
  return { version: 2, items };
}
