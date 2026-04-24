import type { PluginEntry } from "../api/types";
import { DataGateway } from "../dataGateway";
import { layoutWithGrid } from "./gridPlacement";
import { parseDashboardLayout, saveDashboardLayout } from "./layoutStorage";
import type { DashboardLayoutV2 } from "./types";
import { isLayoutV2 } from "./types";

export type DashboardDataBootstrapHandlers = {
  onPluginsLoaded: (items: PluginEntry[]) => void;
  onPluginListError: (message: string) => void;
  onServerLayoutApplied: (layout: DashboardLayoutV2) => void;
  /** GET layout failed or was skipped — UI should treat current layout as cache-only. */
  onLayoutHydrationFromServerFailed?: () => void;
  onLiveCpuPercent: (value: number | null) => void;
};

/**
 * Plugins list, default dashboard layout GET, and fabric SSE (CPU live metric).
 * Hash routing and theme listeners stay in App.svelte.
 */
export function mountDashboardGatewaySideEffects(
  gateway: DataGateway,
  handlers: DashboardDataBootstrapHandlers,
): () => void {
  void gateway
    .listPlugins()
    .then((r) => {
      handlers.onPluginsLoaded(r.items);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? (e.message ? e.message : String(e)) : String(e);
      handlers.onPluginListError(message);
    });

  void gateway
    .getDashboardLayout("default")
    .then((raw) => {
      const parsed = parseDashboardLayout(raw);
      if (!parsed) return;
      const withGrid = layoutWithGrid(parsed);
      if (!isLayoutV2(withGrid)) return;
      handlers.onServerLayoutApplied(withGrid);
      saveDashboardLayout(withGrid);
    })
    .catch(() => {
      /* In-memory mock 404, or no API: keep initial layout from localStorage. */
      handlers.onLayoutHydrationFromServerFailed?.();
    });

  const unsub = gateway.subscribeFabricEvents(
    (ev) => {
      if (ev.topic === "fabric.perf.updated") {
        const v = ev.payload.cpu_percent_total;
        if (typeof v === "number" && Number.isFinite(v)) {
          handlers.onLiveCpuPercent(v);
        }
      }
    },
    () => {},
  );

  return () => {
    unsub();
  };
}
