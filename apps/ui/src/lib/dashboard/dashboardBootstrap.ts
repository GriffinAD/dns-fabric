import type { PluginEntry } from "../api/types";
import { DataGateway } from "../dataGateway";
import { layoutWithGrid } from "./gridPlacement";
import type { FabricEventBus } from "./eventBus";
import { parseDashboardLayout, saveDashboardLayout } from "./layoutStorage";
import type { DashboardLayoutV3 } from "./types";
import { isLayoutV3 } from "./types";

export type DashboardDataBootstrapHandlers = {
  onPluginsLoaded: (items: PluginEntry[]) => void;
  onPluginListError: (message: string) => void;
  onServerLayoutApplied: (layout: DashboardLayoutV3) => void;
  /** GET layout failed or was skipped — UI should treat current layout as cache-only. */
  onLayoutHydrationFromServerFailed?: () => void;
};

/**
 * Plugins list, default dashboard layout GET, and fabric SSE via `bus` (`docs/planning/UI_ENGINE_PLAN.md` P5).
 * Hash routing and theme listeners stay in App.svelte.
 */
export function mountDashboardGatewaySideEffects(
  gateway: DataGateway,
  bus: FabricEventBus,
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
      if (!isLayoutV3(withGrid)) return;
      handlers.onServerLayoutApplied(withGrid);
      saveDashboardLayout(withGrid);
    })
    .catch(() => {
      /* In-memory mock 404, or no API: keep initial layout from localStorage. */
      handlers.onLayoutHydrationFromServerFailed?.();
    });

  const stopBus = bus.connect();

  return () => {
    stopBus();
  };
}
