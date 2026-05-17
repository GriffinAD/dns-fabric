import type { Component } from "svelte";
import { describe, expect, it } from "vitest";

import { createFabricEventBus } from "../dashboard/eventBus";
import type { DashboardTile } from "../dashboard/types";
import type { DataGateway } from "../dataGateway";
import type { TileHostContext } from "./registry";
import DhcpClientsTile from "./DhcpClientsTile.svelte";
import DhcpPoolsTile from "./DhcpPoolsTile.svelte";
import DhcpReservationsTile from "./DhcpReservationsTile.svelte";
import {
  manifestRegistry,
  registerDynamicPluginPrefixResolver,
  registerDynamicPluginResolver,
  resolvePluginTileMount,
  resolvePluginTileSettings,
} from "./registry";

const BUILTIN_TILE_IDS = [
  "dhcp.pools",
  "dhcp.clients",
  "dhcp.reservations",
  "discovery.records",
  "perf.summary",
  "perf.cpu",
  "perf.ram",
  "perf.network",
  "perf.disk",
] as const;

function tile(pluginId: string): DashboardTile {
  return {
    id: "t1",
    pluginId,
    hostControl: "single-panel",
    displayMode: "full",
  };
}

const gateway = {} as DataGateway;
const bus = createFabricEventBus(gateway);

function hostCtx(overrides: Partial<TileHostContext> & Pick<TileHostContext, "tile">): TileHostContext {
  return {
    gateway,
    bus,
    editLayout: false,
    ...overrides,
  };
}

describe("resolvePluginTileSettings", () => {
  it("returns perf settings component for perf plugin ids", () => {
    expect(resolvePluginTileSettings("perf.cpu")).not.toBeNull();
    expect(resolvePluginTileSettings("dhcp.pools")).toBeNull();
  });
});

describe("ManifestRegistry", () => {
  it("lists built-in plugin ids", () => {
    const ids = manifestRegistry.list().map((r) => r.id);
    expect(ids).toContain("dhcp.pools");
    expect(ids).toContain("perf.summary");
    expect(ids).toContain("discovery.records");
    expect(ids.length).toBeGreaterThanOrEqual(9);
  });

  it("get returns registration for known id", () => {
    expect(manifestRegistry.get("perf.cpu")).toEqual({ id: "perf.cpu" });
    expect(manifestRegistry.get("unknown.xyz")).toBeUndefined();
  });
});

describe("resolvePluginTileMount", () => {
  it.each([...BUILTIN_TILE_IDS])("resolves built-in %s", (pluginId) => {
    const t = tile(pluginId);
    const m = resolvePluginTileMount(hostCtx({ tile: t }));
    expect(m).not.toBeNull();
    expect(m!.props.gateway).toBe(gateway);
    expect(m!.props.bus).toBe(bus);
    expect(m!.props.tile).toBe(t);
  });

  it("dhcp.pools uses DhcpPoolsTile", () => {
    const m = resolvePluginTileMount(hostCtx({ tile: tile("dhcp.pools") }));
    expect(m!.component).toBe(DhcpPoolsTile);
  });

  it("dhcp.clients uses DhcpClientsTile", () => {
    const m = resolvePluginTileMount(hostCtx({ tile: tile("dhcp.clients") }));
    expect(m!.component).toBe(DhcpClientsTile);
  });

  it("dhcp.reservations uses DhcpReservationsTile", () => {
    const m = resolvePluginTileMount(hostCtx({ tile: tile("dhcp.reservations") }));
    expect(m!.component).toBe(DhcpReservationsTile);
  });

  it("perf.cpu uses PerfMetricTile with metric cpu", () => {
    const m = resolvePluginTileMount(hostCtx({ tile: tile("perf.cpu") }));
    expect(m!.props.metric).toBe("cpu");
  });

  it("returns null for unknown plugin", () => {
    expect(
      resolvePluginTileMount(hostCtx({ tile: tile("audit.log") })),
    ).toBeNull();
  });

  it("resolves perf.summary without live SSE drill props (bus via context)", () => {
    const m = resolvePluginTileMount(hostCtx({ tile: tile("perf.summary") }));
    expect(m).not.toBeNull();
    expect("liveCpuPercent" in m!.props).toBe(false);
  });

  it("wires onGridHint when onPerfTileGridHint is set", () => {
    const t = tile("perf.cpu");
    let seen: { tileId: string; hint: { colSpan: number; rowSpan: number } } | null = null;
    const m = resolvePluginTileMount(
      hostCtx({
        tile: t,
        onPerfTileGridHint: (tileId, hint) => {
          seen = { tileId, hint };
        },
      }),
    );
    expect(m).not.toBeNull();
    const onGridHint = m!.props.onGridHint as (h: { colSpan: number; rowSpan: number }) => void;
    expect(typeof onGridHint).toBe("function");
    onGridHint({ colSpan: 3, rowSpan: 2 });
    expect(seen).toEqual({ tileId: "t1", hint: { colSpan: 3, rowSpan: 2 } });
  });

  it.each(["perf.ram", "perf.network", "perf.disk"] as const)(
    "invokes onGridHint for %s when handler set",
    (pluginId) => {
      const t = tile(pluginId);
      let calls = 0;
      const m = resolvePluginTileMount(
        hostCtx({
          tile: t,
          onPerfTileGridHint: () => {
            calls += 1;
          },
        }),
      );
      expect(m).not.toBeNull();
      const onGridHint = m!.props.onGridHint as (h: { colSpan: number; rowSpan: number }) => void;
      onGridHint({ colSpan: 1, rowSpan: 1 });
      expect(calls).toBe(1);
    },
  );

  it("discovery.records passes onOpenSettings when editLayout and onEditTile", () => {
    const t = tile("discovery.records");
    let edited: DashboardTile | null = null;
    const m = resolvePluginTileMount(
      hostCtx({
        tile: t,
        editLayout: true,
        onEditTile: (x) => {
          edited = x;
        },
      }),
    );
    expect(m).not.toBeNull();
    const open = m!.props.onOpenSettings as (() => void) | undefined;
    expect(typeof open).toBe("function");
    open!();
    expect(edited).toBe(t);
  });

  it("discovery.records omits onOpenSettings when not editLayout", () => {
    const m = resolvePluginTileMount(
      hostCtx({
        tile: tile("discovery.records"),
        onEditTile: () => {},
      }),
    );
    expect(m!.props.onOpenSettings).toBeUndefined();
  });

  it("ManifestRegistry.register adds id", () => {
    const id = `custom.plugin.${Math.random().toString(36).slice(2, 10)}`;
    expect(manifestRegistry.get(id)).toBeUndefined();
    manifestRegistry.register({ id });
    expect(manifestRegistry.get(id)).toEqual({ id });
  });

  it("ManifestRegistry.unregister removes a runtime id", () => {
    const id = `custom.plugin.${Math.random().toString(36).slice(2, 10)}`;
    manifestRegistry.register({ id });
    manifestRegistry.unregister(id);
    expect(manifestRegistry.get(id)).toBeUndefined();
  });
});

describe("registerDynamicPluginResolver", () => {
  it("resolves until teardown", () => {
    const id = `dynamic.${Math.random().toString(36).slice(2, 10)}`;
    const teardown = registerDynamicPluginResolver(id, (ctx) => ({
      component: DhcpPoolsTile as Component<Record<string, unknown>>,
      props: { gateway: ctx.gateway, bus: ctx.bus, tile: ctx.tile },
    }));
    const m = resolvePluginTileMount(hostCtx({ tile: tile(id) }));
    expect(m).not.toBeNull();
    teardown();
    expect(resolvePluginTileMount(hostCtx({ tile: tile(id) }))).toBeNull();
    expect(manifestRegistry.get(id)).toBeUndefined();
  });
});

describe("registerDynamicPluginPrefixResolver", () => {
  it("resolves ids under prefix except excluded ids", () => {
    const mount = (ctx: TileHostContext) => ({
      component: DhcpPoolsTile as Component<Record<string, unknown>>,
      props: { gateway: ctx.gateway, bus: ctx.bus, tile: ctx.tile },
    });
    const exactId = `pfx.${Math.random().toString(36).slice(2, 8)}.root`;
    const childId = `pfx.${Math.random().toString(36).slice(2, 8)}.child`;
    const unregExact = registerDynamicPluginResolver(exactId, mount);
    const unregPrefix = registerDynamicPluginPrefixResolver("pfx.", [exactId], mount);
    expect(resolvePluginTileMount(hostCtx({ tile: tile(exactId) }))).not.toBeNull();
    expect(resolvePluginTileMount(hostCtx({ tile: tile(childId) }))).not.toBeNull();
    unregPrefix();
    expect(resolvePluginTileMount(hostCtx({ tile: tile(childId) }))).toBeNull();
    unregExact();
  });
});
