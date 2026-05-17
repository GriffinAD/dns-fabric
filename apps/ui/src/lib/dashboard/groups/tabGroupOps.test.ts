import { describe, expect, it, vi } from "vitest";

import {
  activeTabChild,
  addTabChild,
  addTabContainer,
  removeTabChild,
  renameTabChild,
  reorderTabChildren,
  setActiveTab,
  tabStripLabel,
} from "./tabGroupOps";
import type { DashboardGroup } from "../types";
import { MAX_TAB_GROUP_CHILDREN } from "../types";

function tabGroup(): DashboardGroup {
  return {
    kind: "group",
    id: "g1",
    showBorder: true,
    hostControl: "tab-control",
    hostState: { activeChildId: "a" },
    children: [
      {
        id: "a",
        tabLabel: "A",
        pluginId: "perf.cpu",
        hostControl: "single-panel",
        displayMode: "full",
      },
    ],
  };
}

describe("tabGroupOps", () => {
  it("tabStripLabel uses tabLabel or falls back to id", () => {
    const g = tabGroup();
    expect(tabStripLabel(g.children[0]!)).toBe("A");
    expect(tabStripLabel({ ...g.children[0]!, tabLabel: undefined })).toBe("a");
  });

  it("activeTabChild resolves hostState or first child", () => {
    expect(activeTabChild(tabGroup())?.id).toBe("a");
    const stale = { ...tabGroup(), hostState: { activeChildId: "missing" } };
    expect(activeTabChild(stale)?.id).toBe("a");
    expect(activeTabChild({ ...tabGroup(), children: [] })).toBeUndefined();
  });

  it("addTabChild appends a new tile tab", () => {
    const next = addTabChild(tabGroup(), { pluginId: "perf.ram", tabLabel: "RAM" });
    expect(next.children).toHaveLength(2);
    expect(next.children[1]).toMatchObject({ pluginId: "perf.ram", tabLabel: "RAM" });
    expect(next.hostState?.activeChildId).toBe(next.children[1]!.id);
  });

  it("renameTabChild updates tabLabel", () => {
    const next = renameTabChild(tabGroup(), "a", "CPU gauge");
    expect(next.children[0]).toMatchObject({ tabLabel: "CPU gauge" });
  });

  it("removeTabChild drops tab and fixes activeChildId", () => {
    const g = addTabChild(tabGroup(), { pluginId: "perf.ram", tabLabel: "RAM" });
    const next = removeTabChild(g, "a");
    expect(next.children).toHaveLength(1);
    expect(next.hostState?.activeChildId).toBe(next.children[0]!.id);
  });

  it("removeTabChild keeps activeChildId when removing inactive tab", () => {
    const g = addTabChild(tabGroup(), { pluginId: "perf.ram", tabLabel: "RAM" });
    const ramId = g.children[1]!.id;
    const next = removeTabChild(g, ramId);
    expect(next.children).toHaveLength(1);
    expect(next.hostState?.activeChildId).toBe("a");
  });

  it("removeTabChild throws when removing the last tab", () => {
    expect(() => removeTabChild(tabGroup(), "a")).toThrow(/last tab/i);
  });

  it("reorderTabChildren permutes children by id order", () => {
    const g = addTabChild(tabGroup(), { pluginId: "perf.ram", tabLabel: "RAM" });
    const [first, second] = g.children;
    const next = reorderTabChildren(g, [second!.id, first!.id]);
    expect(next.children.map((c) => c.id)).toEqual([second!.id, first!.id]);
  });

  it("setActiveTab sets hostState.activeChildId", () => {
    const g = addTabChild(tabGroup(), { pluginId: "perf.ram", tabLabel: "RAM" });
    const ramId = g.children[1]!.id;
    const next = setActiveTab(g, ramId);
    expect(next.hostState?.activeChildId).toBe(ramId);
  });

  it("addTabContainer appends empty nested tab-control group", () => {
    const next = addTabContainer(tabGroup(), { tabLabel: "Nested" });
    expect(next.children).toHaveLength(2);
    const nested = next.children[1];
    expect(nested).toMatchObject({
      kind: "group",
      tabLabel: "Nested",
      hostControl: "tab-control",
      showBorder: true,
      children: [],
    });
  });

  it("addTabChild throws at max tab count", () => {
    let g = tabGroup();
    for (let i = 0; i < MAX_TAB_GROUP_CHILDREN - 1; i++) {
      g = addTabChild(g, { pluginId: "perf.ram", tabLabel: `T${i}` });
    }
    expect(g.children).toHaveLength(MAX_TAB_GROUP_CHILDREN);
    expect(() => addTabChild(g, { pluginId: "perf.ram", tabLabel: "overflow" })).toThrow(
      /maximum/i,
    );
  });

  it("addTabChild uses unique id when timestamp collides", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const g = addTabChild(tabGroup(), { pluginId: "perf.ram", tabLabel: "RAM" });
    const next = addTabChild(g, { pluginId: "perf.ram", tabLabel: "RAM 2" });
    expect(next.children[2]!.id).toBe(`tab-perf-ram-${now}-1`);
    vi.restoreAllMocks();
  });

  it("addTabChild accepts custom displayMode", () => {
    const next = addTabChild(tabGroup(), {
      pluginId: "dhcp.pools",
      tabLabel: "Pools",
      displayMode: "compact",
    });
    expect(next.children[1]).toMatchObject({ displayMode: "compact" });
  });

  it("addTabContainer defaults tabLabel to Tabs", () => {
    const next = addTabContainer(tabGroup());
    expect(next.children[1]).toMatchObject({ tabLabel: "Tabs" });
  });

  it("addTabContainer throws when id collides with existing child", () => {
    expect(() => addTabContainer(tabGroup(), { id: "a", tabLabel: "Dup" })).toThrow(
      /already exists/i,
    );
  });

  it("addTabContainer throws at max tab count", () => {
    let g = tabGroup();
    for (let i = 0; i < MAX_TAB_GROUP_CHILDREN - 1; i++) {
      g = addTabContainer(g, { tabLabel: `Nested ${i}` });
    }
    expect(() => addTabContainer(g, { tabLabel: "overflow" })).toThrow(/maximum/i);
  });

  it("throws when group is not tab-control", () => {
    const panel: DashboardGroup = { ...tabGroup(), hostControl: "panel" };
    expect(() => addTabChild(panel, { pluginId: "perf.ram", tabLabel: "RAM" })).toThrow(
      /tab-control container/i,
    );
  });

  it("renameTabChild throws for unknown child", () => {
    expect(() => renameTabChild(tabGroup(), "missing", "x")).toThrow(/not found/i);
  });

  it("removeTabChild throws for unknown child", () => {
    const g = addTabChild(tabGroup(), { pluginId: "perf.ram", tabLabel: "RAM" });
    expect(() => removeTabChild(g, "missing")).toThrow(/not found/i);
  });

  it("removeTabChild resets stale activeChildId", () => {
    const g = addTabChild(
      { ...tabGroup(), hostState: { activeChildId: "stale" } },
      { pluginId: "perf.ram", tabLabel: "RAM" },
    );
    const next = removeTabChild(g, "a");
    expect(next.hostState?.activeChildId).toBe(next.children[0]!.id);
  });

  it("reorderTabChildren throws when orderedIds length mismatches", () => {
    expect(() => reorderTabChildren(tabGroup(), ["a", "b"])).toThrow(/exactly once/i);
  });

  it("reorderTabChildren throws for unknown id", () => {
    expect(() => reorderTabChildren(tabGroup(), ["missing"])).toThrow(/not found/i);
  });

  it("setActiveTab throws for unknown child", () => {
    expect(() => setActiveTab(tabGroup(), "missing")).toThrow(/not found/i);
  });
});
