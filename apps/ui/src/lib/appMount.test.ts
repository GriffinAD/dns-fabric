import { afterEach, describe, expect, it, vi } from "vitest";

import { attachOperatorShellLifecycle } from "./appMount";
import type { DashboardDataBootstrapHandlers } from "./dashboard/dashboardBootstrap";
import { createFabricEventBus, type FabricEventBus } from "./dashboard/eventBus";
import { createLayoutStore } from "./dashboard/layoutStore";
import { DataGateway } from "./dataGateway";
import * as themeStorage from "./theme/themeStorage";
import type { DashboardLayoutV2 } from "./dashboard/types";

const { mountDashboardSideEffectsMock } = vi.hoisted(() => ({
  mountDashboardSideEffectsMock: vi.fn(() => vi.fn()),
}));

vi.mock("./dashboard/dashboardBootstrap", () => ({
  mountDashboardGatewaySideEffects: mountDashboardSideEffectsMock,
}));

describe("attachOperatorShellLifecycle", () => {
  afterEach(() => {
    mountDashboardSideEffectsMock.mockReset();
    vi.restoreAllMocks();
  });

  it("registers listeners, runs bootstrap handlers, and tears down", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    let mqlChange: (() => void) | undefined;
    const mm = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn((_ev: string, cb: () => void) => {
        mqlChange = cb;
      }),
      removeEventListener: vi.fn(),
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(mm as unknown as MediaQueryList);

    const gateway = new DataGateway("");
    const bus = createFabricEventBus(gateway);
    const ls = createLayoutStore({ gateway });
    const syncRoute = vi.fn();
    const flushSpy = vi.spyOn(ls, "flush").mockResolvedValue(undefined);
    vi.spyOn(ls, "acceptServerLayout").mockImplementation(() => {});
    vi.spyOn(ls, "markLayoutHydratedFromCacheOnly").mockImplementation(() => {});
    const setPlugins = vi.fn();
    const stopBootstrap = vi.fn();

    const minimalLayout: DashboardLayoutV2 = { version: 2, items: [] };
    mountDashboardSideEffectsMock.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((_gw: DataGateway, _bus: FabricEventBus, handlers: DashboardDataBootstrapHandlers) => {
        handlers.onPluginsLoaded([]);
        handlers.onPluginListError("list-fail");
        handlers.onServerLayoutApplied(minimalLayout);
        handlers.onLayoutHydrationFromServerFailed?.();
        return stopBootstrap;
      }) as any,
    );

    const loadSpy = vi.spyOn(themeStorage, "loadThemePreferences").mockReturnValue({
      version: 1,
      mode: "system",
      colorPreset: "default",
      gaugeCapStyle: "flat",
      gaugeSegmentEnabled: false,
      gaugeSegmentDivisions: 0,
      gaugeSegmentLines: false,
      gaugeSegmentGapPx: 0.2,
    });
    const resyncSpy = vi.spyOn(themeStorage, "resyncDocumentThemeFromStorage").mockImplementation(() => {});

    const teardown = attachOperatorShellLifecycle({
      syncRouteFromHash: syncRoute,
      gateway,
      fabricEventBus: bus,
      layoutStore: ls,
      setPlugins,
    });

    expect(mountDashboardSideEffectsMock).toHaveBeenCalledOnce();
    expect(addSpy.mock.calls.some((c) => c[0] === "hashchange")).toBe(true);
    expect(addSpy.mock.calls.some((c) => c[0] === "beforeunload")).toBe(true);

    const hashHandler = addSpy.mock.calls.find((c) => c[0] === "hashchange")?.[1] as () => void;
    const beforeUnloadHandler = addSpy.mock.calls.find((c) => c[0] === "beforeunload")?.[1] as () => void;
    hashHandler();
    expect(syncRoute).toHaveBeenCalledOnce();
    beforeUnloadHandler();
    expect(flushSpy).toHaveBeenCalledOnce();

    mqlChange?.();
    expect(loadSpy).toHaveBeenCalled();
    expect(resyncSpy).toHaveBeenCalledOnce();

    expect(setPlugins).toHaveBeenCalledWith([]);

    teardown();

    expect(stopBootstrap).toHaveBeenCalledOnce();
    expect(removeSpy.mock.calls.some((c) => c[0] === "hashchange")).toBe(true);
    expect(removeSpy.mock.calls.some((c) => c[0] === "beforeunload")).toBe(true);
    expect(mm.removeEventListener).toHaveBeenCalled();
  });
});
