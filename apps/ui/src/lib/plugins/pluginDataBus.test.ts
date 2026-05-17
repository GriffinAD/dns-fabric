import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, unmount } from "svelte";

import { createFabricEventBus } from "../dashboard/eventBus";
import type { DataGateway } from "../dataGateway";
import {
  requireFabricBus,
  subscribeListWithInitialFetch,
  subscribeWithInitialFetch,
} from "./pluginDataBus";
import PluginDataBusUseProbe from "./pluginDataBusUseProbe.test.svelte";

const gateway = {} as DataGateway;

describe("requireFabricBus", () => {
  it("returns bus when defined", () => {
    const bus = createFabricEventBus(gateway);
    expect(requireFabricBus(bus)).toBe(bus);
  });

  it("throws when bus is missing", () => {
    expect(() => requireFabricBus(undefined)).toThrow(/FabricEventBus is required/);
  });
});

describe("subscribeWithInitialFetch", () => {
  it("applies fetch result then bus updates", async () => {
    const bus = createFabricEventBus(gateway);
    const values: number[] = [];
    const release = subscribeWithInitialFetch({
      bus,
      topic: "fabric.perf.updated",
      selector: (p) => (typeof p === "number" ? p : null),
      fetch: async () => 1,
      onValue: (v) => values.push(v),
    });
    await Promise.resolve();
    expect(values).toEqual([1]);
    bus.emit("fabric.perf.updated", 2);
    expect(values).toEqual([1, 2]);
    release();
    bus.emit("fabric.perf.updated", 3);
    expect(values).toEqual([1, 2]);
  });
});

describe("usePluginBusSubscription", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("registers subscribeWithInitialFetch and releases on unmount", async () => {
    const bus = createFabricEventBus(gateway);
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = mount(PluginDataBusUseProbe, { target: el, props: { bus } });
    expect(el.querySelector('[data-testid="plugin-bus-use-probe"]')).toBeTruthy();
    unmount(app);
    el.remove();
  });
});

describe("subscribeListWithInitialFetch", () => {
  it("applies inline items from bus without refetch", async () => {
    const bus = createFabricEventBus(gateway);
    const fetch = vi.fn().mockResolvedValue({ items: [{ id: "a" }] });
    const seen: string[][] = [];
    const release = subscribeListWithInitialFetch({
      bus,
      topic: "fabric.dhcp.clients.updated",
      fetch,
      parseItems: (p) =>
        p && typeof p === "object" && "items" in p
          ? ((p as { items: { id: string }[] }).items ?? null)
          : null,
      onItems: (items) => seen.push(items.map((i) => i.id)),
    });
    await Promise.resolve();
    bus.emit("fabric.dhcp.clients.updated", { items: [{ id: "b" }] });
    expect(seen).toEqual([["a"], ["b"]]);
    expect(fetch).toHaveBeenCalledOnce();
    release();
  });

  it("refetches when topic carries a revision-only payload", async () => {
    const bus = createFabricEventBus(gateway);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: "a" }] })
      .mockResolvedValueOnce({ items: [{ id: "a" }, { id: "b" }] });
    const seen: string[][] = [];
    const release = subscribeListWithInitialFetch({
      bus,
      topic: "fabric.dhcp.pools.updated",
      fetch,
      parseItems: (p) =>
        p && typeof p === "object" && "items" in p
          ? ((p as { items: { id: string }[] }).items ?? null)
          : null,
      onItems: (items) => seen.push(items.map((i) => i.id)),
    });
    await Promise.resolve();
    expect(seen).toEqual([["a"]]);
    bus.emit("fabric.dhcp.pools.updated", { revision: 2 });
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([["a"], ["a", "b"]]);
    release();
  });

  it("ignores payloads that are not objects", async () => {
    const bus = createFabricEventBus(gateway);
    const fetch = vi.fn().mockResolvedValue({ items: [{ id: "a" }] });
    const seen: string[][] = [];
    subscribeListWithInitialFetch({
      bus,
      topic: "fabric.dhcp.pools.updated",
      fetch,
      parseItems: () => null,
      onItems: (items) => seen.push(items.map((i) => i.id)),
    });
    await Promise.resolve();
    bus.emit("fabric.dhcp.pools.updated", "ignored");
    expect(seen).toEqual([["a"]]);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
