import { ensureLayoutV3 } from "../migration";
import type { DashboardGroup, DashboardLayout, DashboardLayoutV3, GroupChild, RootLayoutItem, RootTileItem } from "../types";
import { isDashboardGroupNode } from "../types";

/** Legacy dashboard tiles removed on load (see `docs/planning/UI_ENGINE_PLAN.md` P3.6). */
export const LEGACY_PERF_SUMMARY_PLUGIN_IDS = new Set(["perf.summary"]);

function stripLegacyFromGroupChildren(children: GroupChild[]): GroupChild[] {
  const out: GroupChild[] = [];
  for (const c of children) {
    if (isDashboardGroupNode(c)) {
      const inner = stripLegacyFromGroupChildren(c.children);
      /* Tab/stack section panes are often empty until the operator drops tiles. */
      if (inner.length === 0 && !c.tabLabel) continue;
      out.push({ ...c, children: inner });
    } else if (!LEGACY_PERF_SUMMARY_PLUGIN_IDS.has(c.pluginId)) {
      out.push(c);
    }
  }
  return out;
}

/**
 * Drops legacy `perf.summary` tiles from a layout (root and inside groups).
 * Behaviour preserved from former `withoutLegacyTiles` in `layoutStorage.ts`.
 */
export function stripLegacyPerfSummaryTiles(layout: DashboardLayout): DashboardLayoutV3 {
  const v3In = ensureLayoutV3(layout);
  const items: RootLayoutItem[] = [];
  for (const it of v3In.items) {
    if (it.kind === "group") {
      const children = stripLegacyFromGroupChildren(it.children);
      if (children.length === 0) continue;
      items.push({ ...it, children } satisfies DashboardGroup);
    } else {
      if (LEGACY_PERF_SUMMARY_PLUGIN_IDS.has(it.pluginId)) continue;
      items.push(it satisfies RootTileItem);
    }
  }
  return ensureLayoutV3({ version: 3, items });
}
