import { describe, expect, it } from "vitest";
import { mount, unmount } from "svelte";

import type { PluginEntry } from "../api/types";
import { createFabricEventBus } from "./eventBus";
import type { DataGateway } from "../dataGateway";
import PluginTileMount from "./PluginTileMount.svelte";
import type { DashboardTile } from "./types";

const gateway = {} as DataGateway;
const bus = createFabricEventBus(gateway);

function baseTile(pluginId: string): DashboardTile {
  return {
    id: "t1",
    pluginId,
    hostControl: "single-panel",
    displayMode: "full",
    region: "r",
    grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
  };
}

describe("PluginTileMount", () => {
  it("shows unknown fallback when plugin id is not registered", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = mount(PluginTileMount, {
      target: el,
      props: {
        gateway,
        bus,
        tile: baseTile("audit.never"),
        plugins: [],
      },
    });
    expect(el.querySelector('[data-testid="tile-fallback"][data-fallback-reason="unknown"]')).toBeTruthy();
    unmount(app);
    el.remove();
  });

  it("shows error fallback when tile.options fails Zod for perf plugin", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = mount(PluginTileMount, {
      target: el,
      props: {
        gateway,
        bus,
        tile: {
          ...baseTile("perf.cpu"),
          options: { not_a_valid_key: true } as unknown as DashboardTile["options"],
        },
        plugins: [],
      },
    });
    expect(el.querySelector('[data-testid="tile-fallback"][data-fallback-reason="error"]')).toBeTruthy();
    unmount(app);
    el.remove();
  });

  it("shows disabled fallback when manifest marks plugin disabled", () => {
    const plugins: PluginEntry[] = [{ id: "perf.cpu", name: "CPU", enabled: false }];
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = mount(PluginTileMount, {
      target: el,
      props: {
        gateway,
        bus,
        tile: baseTile("perf.cpu"),
        plugins,
      },
    });
    expect(el.querySelector('[data-testid="tile-fallback"][data-fallback-reason="disabled"]')).toBeTruthy();
    unmount(app);
    el.remove();
  });
});
