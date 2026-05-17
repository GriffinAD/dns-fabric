import type { PluginEntry } from "../api/types";
import type { DataGateway } from "../gateway/dataGateway";
import { mountDashboardGatewaySideEffects } from "../dashboard/dashboardBootstrap";
import type { FabricEventBus } from "../dashboard/eventBus";
import { createLayoutStore } from "../dashboard/layoutStore";
import { loadThemePreferences, resyncDocumentThemeFromStorage } from "../theme/themeStorage";

type LayoutStore = ReturnType<typeof createLayoutStore>;

export type OperatorShellMountInput = {
  syncRouteFromHash: () => void;
  gateway: DataGateway;
  fabricEventBus: FabricEventBus;
  layoutStore: LayoutStore;
  setPlugins: (items: PluginEntry[]) => void;
};

/** Window listeners + gateway bootstrap teardown for `App.svelte` onMount. */
export function attachOperatorShellLifecycle(deps: OperatorShellMountInput): () => void {
  const onHashChange = () => {
    void deps.syncRouteFromHash();
  };
  window.addEventListener("hashchange", onHashChange);

  const onBeforeUnload = () => {
    void deps.layoutStore.flush();
  };
  window.addEventListener("beforeunload", onBeforeUnload);

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onColorScheme = () => {
    if (loadThemePreferences().mode === "system") {
      resyncDocumentThemeFromStorage();
    }
  };
  mq.addEventListener("change", onColorScheme);

  const stopData = mountDashboardGatewaySideEffects(deps.gateway, deps.fabricEventBus, {
    onPluginsLoaded: deps.setPlugins,
    onPluginListError: (message) => deps.layoutStore.loadError.set(message),
    onServerLayoutApplied: (nextLayout) => deps.layoutStore.acceptServerLayout(nextLayout),
    onLayoutHydrationFromServerFailed: () => deps.layoutStore.markLayoutHydratedFromCacheOnly(),
  });

  return () => {
    window.removeEventListener("hashchange", onHashChange);
    window.removeEventListener("beforeunload", onBeforeUnload);
    mq.removeEventListener("change", onColorScheme);
    stopData();
  };
}
