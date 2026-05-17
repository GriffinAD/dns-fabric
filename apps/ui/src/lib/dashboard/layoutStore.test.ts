import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

import { DataGateway } from "../gateway/dataGateway";
import * as layoutNormalize from "./layoutNormalize";
import * as layoutStorage from "./layoutStorage";
import { createLayoutStore } from "./layoutStore";
import type { DashboardGroup, DashboardLayoutV3 } from "./types";
import { isDashboardGroupNode } from "./types";

function minimalLayout(): DashboardLayoutV3 {
  return {
    version: 3,
    items: [
      {
        kind: "tile",
        id: "t1",
        pluginId: "dhcp.pools",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ],
  };
}

function stubLocalStorage() {
  const mem: Record<string, string> = {};
  vi.stubGlobal(
    "localStorage",
    {
      getItem: (k: string) => (k in mem ? mem[k]! : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: (i: number) => Object.keys(mem)[i] ?? null,
      get length() {
        return Object.keys(mem).length;
      },
    } as Storage,
  );
}

describe("createLayoutStore", () => {
  beforeEach(() => {
    stubLocalStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("acceptServerLayout sets layoutSource server and clears loadError", () => {
    const gw = new DataGateway("");
    const ls = createLayoutStore({ gateway: gw });
    ls.loadError.set("x");
    const next = minimalLayout();
    ls.acceptServerLayout(next);
    expect(get(ls.layout)).toEqual(next);
    expect(get(ls.layoutSource)).toBe("server");
    expect(get(ls.loadError)).toBeNull();
  });

  it("acceptServerLayout clears local persist gate after incompatible stored version", () => {
    const mem: Record<string, string> = {
      "kea-fabric-dashboard-layout": JSON.stringify({ version: 9, items: [] }),
    };
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (k: string) => (k in mem ? mem[k]! : null),
        setItem: (k: string, v: string) => {
          mem[k] = v;
        },
        removeItem: (k: string) => {
          delete mem[k];
        },
        clear: () => {
          for (const k of Object.keys(mem)) delete mem[k];
        },
        key: (i: number) => Object.keys(mem)[i] ?? null,
        get length() {
          return Object.keys(mem).length;
        },
      } as Storage,
    );
    const gw = new DataGateway("");
    const ls = createLayoutStore({ gateway: gw });
    expect(get(ls.localPersistBlocked)).toBe(true);
    ls.acceptServerLayout(minimalLayout());
    expect(get(ls.localPersistBlocked)).toBe(false);
    expect(get(ls.localPersistBlockedReason)).toBeNull();
  });

  it("resetToBaseline clears local persist gate when server returns a valid layout", async () => {
    const mem: Record<string, string> = {
      "kea-fabric-dashboard-layout": JSON.stringify({ version: 9, items: [] }),
    };
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (k: string) => (k in mem ? mem[k]! : null),
        setItem: (k: string, v: string) => {
          mem[k] = v;
        },
        removeItem: (k: string) => {
          delete mem[k];
        },
        clear: () => {
          for (const k of Object.keys(mem)) delete mem[k];
        },
        key: (i: number) => Object.keys(mem)[i] ?? null,
        get length() {
          return Object.keys(mem).length;
        },
      } as Storage,
    );
    const gw = new DataGateway("");
    vi.spyOn(gw, "resetDashboardLayout").mockResolvedValue(minimalLayout());
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    expect(get(ls.localPersistBlocked)).toBe(true);
    await ls.resetToBaseline();
    expect(get(ls.localPersistBlocked)).toBe(false);
  });

  it("markLayoutHydratedFromCacheOnly sets cache", () => {
    const gw = new DataGateway("");
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout(minimalLayout());
    ls.markLayoutHydratedFromCacheOnly();
    expect(get(ls.layoutSource)).toBe("cache");
  });

  it("debounces putDashboardLayout by 400ms", async () => {
    vi.useFakeTimers();
    const gw = new DataGateway("");
    const put = vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.applyStructure(minimalLayout());
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(399);
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("coalesces rapid applyStructure calls into one PUT with the latest layout", async () => {
    vi.useFakeTimers();
    const gw = new DataGateway("");
    const put = vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    const first = minimalLayout();
    const second: DashboardLayoutV3 = {
      version: 3,
      items: [
        {
          kind: "tile",
          id: "t-replaced",
          pluginId: "dhcp.clients",
          hostControl: "single-panel",
          displayMode: "full",
        },
      ],
    };
    ls.applyStructure(first);
    ls.applyStructure(second);
    await vi.advanceTimersByTimeAsync(400);
    expect(put).toHaveBeenCalledTimes(1);
    expect(get(ls.layout).items[0]).toMatchObject({ id: "t-replaced", pluginId: "dhcp.clients" });
  });

  it("flush runs put immediately and cancels pending debounce", async () => {
    vi.useFakeTimers();
    const gw = new DataGateway("");
    const put = vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.applyStructure(minimalLayout());
    await ls.flush();
    expect(put).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("persistError is set when PUT fails and cleared on success", async () => {
    vi.useFakeTimers();
    const gw = new DataGateway("");
    const put = vi.spyOn(gw, "putDashboardLayout").mockRejectedValueOnce(new Error("nope"));
    const ls = createLayoutStore({ gateway: gw });
    ls.applyStructure(minimalLayout());
    await vi.advanceTimersByTimeAsync(400);
    expect(get(ls.persistError)).toBe("nope");
    put.mockResolvedValueOnce(undefined);
    await ls.flush();
    expect(get(ls.persistError)).toBeNull();
  });

  it("closeEditorAndFlush sets editorOpen false and persists", async () => {
    vi.useFakeTimers();
    const gw = new DataGateway("");
    const put = vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.openEditor();
    expect(get(ls.editorOpen)).toBe(true);
    ls.applyStructure(minimalLayout());
    await ls.closeEditorAndFlush();
    expect(get(ls.editorOpen)).toBe(false);
    expect(put).toHaveBeenCalled();
  });

  it("addRootTile appends a tile", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({ version: 2, items: [] });
    ls.addRootTile("perf.cpu");
    expect(get(ls.layout).items.length).toBe(1);
    expect(get(ls.layout).items[0]).toMatchObject({ kind: "tile", pluginId: "perf.cpu" });
  });

  it("addRootTile injects Pi-hole palette options for pihole_ha.<section> ids", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({ version: 2, items: [] });
    ls.addRootTile("pihole_ha.docker");
    const t = get(ls.layout).items[0];
    expect(t?.kind).toBe("tile");
    if (t?.kind !== "tile") return;
    expect(t.pluginId).toBe("pihole_ha.docker");
    expect(t.options).toMatchObject({
      section: "docker",
      title: "Docker",
    });
    expect(typeof (t.options as { widgetId?: string }).widgetId).toBe("string");
  });

  it("addRootTile injects legacy Pi-hole section defaults for pihole_ha.section", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({ version: 2, items: [] });
    ls.addRootTile("pihole_ha.section");
    const t = get(ls.layout).items[0];
    expect(t?.kind).toBe("tile");
    if (t?.kind !== "tile") return;
    expect(t.options).toMatchObject({ section: "ha", title: "Ha" });
  });

  it("addGroup appends a group", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({ version: 2, items: [] });
    ls.addGroup();
    expect(get(ls.layout).items.length).toBe(1);
    expect(get(ls.layout).items[0]).toMatchObject({ kind: "group", children: [] });
  });

  it("addRootTile inserts before index when provided", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout(minimalLayout());
    ls.addRootTile("perf.ram", 0);
    expect(get(ls.layout).items.length).toBe(2);
    expect(get(ls.layout).items[0]).toMatchObject({ kind: "tile", pluginId: "perf.ram" });
    expect(get(ls.layout).items[1]).toMatchObject({ id: "t1" });
  });

  it("addGroup inserts before index when provided", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout(minimalLayout());
    ls.addGroup(0);
    expect(get(ls.layout).items.length).toBe(2);
    expect(get(ls.layout).items[0]).toMatchObject({ kind: "group" });
    expect(get(ls.layout).items[1]).toMatchObject({ id: "t1" });
  });

  it("addGroupToParent appends nested group when parent allows nesting", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({
      version: 3,
      items: [{ kind: "group", id: "g1", showBorder: true, children: [] }],
    });
    ls.addGroupToParent("g1");
    const g = get(ls.layout).items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind === "group") {
      expect(g.children.length).toBe(1);
      expect(g.children[0]).toMatchObject({
        kind: "group",
        grid: { col: 0, row: 0, colSpan: 10, rowSpan: 1 },
      });
    }
  });

  it("addGroupToParent rejects innerWrap parent with loadError", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({
      version: 3,
      items: [{ kind: "group", id: "g1", showBorder: true, innerWrap: true, children: [] }],
    });
    ls.addGroupToParent("g1");
    expect(get(ls.loadError)).toMatch(/Auto wrap/i);
    const g = get(ls.layout).items[0];
    if (g?.kind === "group") expect(g.children.length).toBe(0);
  });

  it("addGroupToParent sets loadError when parent id is missing", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout(minimalLayout());
    ls.addGroupToParent("no-such-group");
    expect(get(ls.loadError)).toMatch(/not found/i);
  });

  function groupChain(depth: number, base: string): DashboardGroup {
    if (depth < 1) throw new Error("depth");
    if (depth === 1) {
      return { kind: "group", id: `${base}-1`, showBorder: true, children: [] };
    }
    return { kind: "group", id: `${base}-${depth}`, showBorder: true, children: [groupChain(depth - 1, base)] };
  }

  function deepestEmptyGroupId(g: DashboardGroup): string {
    const only = g.children[0];
    if (only && isDashboardGroupNode(only) && only.children.length > 0) {
      return deepestEmptyGroupId(only);
    }
    if (only && isDashboardGroupNode(only)) return only.id;
    return g.id;
  }

  it("addGroupToParent rejects when nesting would exceed max depth", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    const top = groupChain(8, "d");
    ls.acceptServerLayout({ version: 3, items: [top] });
    ls.addGroupToParent(deepestEmptyGroupId(top));
    expect(get(ls.loadError)).toMatch(/depth/i);
  });

  it("addTileToGroup does not add children when group id is missing", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({
      version: 2,
      items: [{ kind: "group", id: "g1", showBorder: true, children: [] }],
    });
    ls.addTileToGroup("missing", "dhcp.clients");
    const g = get(ls.layout).items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind === "group") expect(g.children.length).toBe(0);
  });

  it("addTileToGroup adds child to matching group", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({
      version: 2,
      items: [{ kind: "group", id: "g1", showBorder: true, children: [] }],
    });
    ls.addTileToGroup("g1", "dhcp.clients");
    const g = get(ls.layout).items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind === "group") {
      expect(g.children.length).toBe(1);
      const child = g.children[0];
      expect(child && "pluginId" in child ? child.pluginId : undefined).toBe("dhcp.clients");
    }
  });

  it("addTileToGroup injects Pi-hole palette options for pihole_ha.<section> ids", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout({
      version: 3,
      items: [{ kind: "group", id: "g1", showBorder: true, children: [] }],
    });
    ls.addTileToGroup("g1", "pihole_ha.docker");
    const g = get(ls.layout).items[0];
    expect(g?.kind).toBe("group");
    if (g?.kind !== "group") return;
    expect(g.children.length).toBe(1);
    const c = g.children[0];
    expect(c && "pluginId" in c ? c.pluginId : undefined).toBe("pihole_ha.docker");
    if (!c || !("pluginId" in c)) return;
    expect(c.options).toMatchObject({ section: "docker", title: "Docker" });
  });

  it("applyStructure records loadError when normalize throws", () => {
    const gw = new DataGateway("");
    const ls = createLayoutStore({ gateway: gw });
    const spy = vi.spyOn(layoutNormalize, "normalizeLayoutStrict").mockImplementation(() => {
      throw new Error("norm");
    });
    ls.applyStructure(minimalLayout());
    expect(get(ls.loadError)).toBe("norm");
    spy.mockRestore();
  });

  it("applyStructure stringifies non-Error normalize failures", () => {
    const gw = new DataGateway("");
    const ls = createLayoutStore({ gateway: gw });
    const spy = vi.spyOn(layoutNormalize, "normalizeLayoutStrict").mockImplementation(() => {
      throw "not an error";
    });
    ls.applyStructure(minimalLayout());
    expect(get(ls.loadError)).toBe("not an error");
    spy.mockRestore();
  });

  it("applyStructure uses editModeOverride when provided", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    const spy = vi.spyOn(layoutNormalize, "normalizeLayoutStrict");
    ls.openEditor();
    ls.applyStructure(minimalLayout(), { editModeOverride: false });
    expect(spy).toHaveBeenCalledWith(expect.anything(), false, expect.anything());
    spy.mockRestore();
  });

  it("persistError uses String when PUT rejects non-Error", async () => {
    vi.useFakeTimers();
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockRejectedValueOnce("plain");
    const ls = createLayoutStore({ gateway: gw });
    ls.applyStructure(minimalLayout());
    await vi.advanceTimersByTimeAsync(400);
    expect(get(ls.persistError)).toBe("plain");
  });

  it("resetToBaseline applies parsed layout from server", async () => {
    const gw = new DataGateway("");
    const next = minimalLayout();
    vi.spyOn(gw, "resetDashboardLayout").mockResolvedValue(next);
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    await ls.resetToBaseline();
    const L = get(ls.layout);
    expect(L.items[0]?.id).toBe("t1");
    expect(L.items[0]).toMatchObject({ pluginId: "dhcp.pools", kind: "tile" });
    expect(L.items[0] && "grid" in L.items[0] && L.items[0].grid).toBeDefined();
  });

  it("resetToBaseline sets loadError when response is unparseable", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "resetDashboardLayout").mockResolvedValue({ version: 2, items: "bad" } as never);
    const ls = createLayoutStore({ gateway: gw });
    await ls.resetToBaseline();
    expect(get(ls.loadError)).toBe("Reset returned an invalid layout.");
  });

  it("resetToBaseline sets loadError when reset throws", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "resetDashboardLayout").mockRejectedValue(new Error("reset failed"));
    const ls = createLayoutStore({ gateway: gw });
    await ls.resetToBaseline();
    expect(get(ls.loadError)).toBe("reset failed");
  });

  it("resetToBaseline stringifies non-Error rejections", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "resetDashboardLayout").mockRejectedValue("offline");
    const ls = createLayoutStore({ gateway: gw });
    await ls.resetToBaseline();
    expect(get(ls.loadError)).toBe("offline");
  });

  it("saveLayoutToFile POSTs save-file, persists locally, and skips debounced PUT", async () => {
    vi.useFakeTimers();
    const gw = new DataGateway("");
    const put = vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const postSave = vi
      .spyOn(gw, "postDashboardLayoutSaveFile")
      .mockResolvedValue({ filename: "Dashboard_Layout_2026-04-25_123456.json" });
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout(minimalLayout());
    await ls.saveLayoutToFile();
    expect(postSave).toHaveBeenCalledTimes(1);
    expect(postSave).toHaveBeenCalledWith("default", expect.objectContaining({ version: 3, items: expect.any(Array) }));
    await vi.advanceTimersByTimeAsync(500);
    expect(put).not.toHaveBeenCalled();
  });

  it("saveLayoutToFile sets persistError and skips localStorage when POST fails", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "postDashboardLayoutSaveFile").mockRejectedValue(new Error("server down"));
    const saveLocal = vi.spyOn(layoutStorage, "saveDashboardLayout");
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout(minimalLayout());
    saveLocal.mockClear();
    await ls.saveLayoutToFile();
    expect(get(ls.persistError)).toBe("server down");
    expect(saveLocal).not.toHaveBeenCalled();
  });

  it("saveLayoutToFile stringifies non-Error POST rejections", async () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "postDashboardLayoutSaveFile").mockRejectedValue("offline");
    const ls = createLayoutStore({ gateway: gw });
    ls.acceptServerLayout(minimalLayout());
    await ls.saveLayoutToFile();
    expect(get(ls.persistError)).toBe("offline");
  });

  it("undo and redo snapshot layout while editor is open", () => {
    const gw = new DataGateway("");
    const ls = createLayoutStore({ gateway: gw });
    ls.openEditor();
    const a = minimalLayout();
    ls.acceptServerLayout(a);
    ls.addRootTile("perf.cpu");
    const afterAdd = get(ls.layout);
    expect(afterAdd.items.length).toBeGreaterThan(a.items.length);
    ls.undo();
    expect(get(ls.layout)).toEqual(a);
    ls.redo();
    expect(get(ls.layout)).toEqual(afterAdd);
  });

  it("applyStructure trims undo past stack beyond UNDO_CAP", () => {
    const gw = new DataGateway("");
    vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({ gateway: gw });
    ls.openEditor();
    ls.acceptServerLayout(minimalLayout());
    for (let i = 0; i < 52; i++) {
      ls.addRootTile("perf.cpu");
    }
    expect(get(ls.layout).items.length).toBeGreaterThan(50);
    expect(ls.canUndo()).toBe(true);
  });

  it("canUndo and canRedo reflect stack state", () => {
    const gw = new DataGateway("");
    const ls = createLayoutStore({ gateway: gw });
    expect(ls.canUndo()).toBe(false);
    expect(ls.canRedo()).toBe(false);
    ls.openEditor();
    ls.acceptServerLayout(minimalLayout());
    ls.addRootTile("perf.cpu");
    expect(ls.canUndo()).toBe(true);
    ls.undo();
    expect(ls.canRedo()).toBe(true);
  });

  it("undo and redo are safe when stacks are empty", () => {
    const gw = new DataGateway("");
    const ls = createLayoutStore({ gateway: gw });
    ls.undo();
    ls.redo();
    expect(get(ls.layout)).toBeDefined();
  });

  it("skipServerLayoutPersist skips debounced PUT on edits", async () => {
    vi.useFakeTimers();
    const gw = new DataGateway("");
    const put = vi.spyOn(gw, "putDashboardLayout").mockResolvedValue(undefined);
    const ls = createLayoutStore({
      gateway: gw,
      skipServerLayoutPersist: true,
      initialLayout: minimalLayout(),
    });
    ls.openEditor();
    ls.addRootTile("perf.cpu");
    await vi.advanceTimersByTimeAsync(500);
    expect(put).not.toHaveBeenCalled();
  });

  it("skipServerLayoutPersist saveLayoutToFile skips POST", async () => {
    const gw = new DataGateway("");
    const postSave = vi.spyOn(gw, "postDashboardLayoutSaveFile");
    const ls = createLayoutStore({
      gateway: gw,
      skipServerLayoutPersist: true,
      initialLayout: minimalLayout(),
    });
    await ls.saveLayoutToFile();
    expect(postSave).not.toHaveBeenCalled();
  });

  it("skipServerLayoutPersist resetToBaseline sets loadError without calling gateway", async () => {
    const gw = new DataGateway("");
    const reset = vi.spyOn(gw, "resetDashboardLayout");
    const ls = createLayoutStore({
      gateway: gw,
      skipServerLayoutPersist: true,
      initialLayout: minimalLayout(),
    });
    await ls.resetToBaseline();
    expect(reset).not.toHaveBeenCalled();
    expect(get(ls.loadError)).toBe("Reset to server baseline is not available in this workspace.");
  });

  it("persists layout to custom layoutStorageKey", () => {
    const saveLocal = vi.spyOn(layoutStorage, "saveDashboardLayout");
    const gw = new DataGateway("");
    const key = "custom-layout-key";
    const ls = createLayoutStore({
      gateway: gw,
      layoutStorageKey: key,
      skipServerLayoutPersist: true,
      initialLayout: minimalLayout(),
    });
    ls.openEditor();
    ls.addRootTile("perf.cpu");
    expect(saveLocal.mock.calls.some((c) => c[1] === key)).toBe(true);
  });
});
