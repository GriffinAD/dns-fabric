import { describe, expect, it } from "vitest";

import type { DashboardGroup } from "../types";
import { MAX_TAB_GROUP_CHILDREN } from "../types";
import {
  addStackChild,
  addStackSection,
  isStackSectionCollapsed,
  removeStackChild,
  renameStackChild,
  stackSectionLabel,
  toggleStackSectionCollapsed,
} from "./verticalStackGroupOps";
import { makeVerticalStackGroup } from "./hostGroupFactory";

function stackGroup(): DashboardGroup {
  return makeVerticalStackGroup("stack-1");
}

describe("verticalStackGroupOps", () => {
  it("stackSectionLabel uses tab strip label helper", () => {
    const g = stackGroup();
    expect(stackSectionLabel(g.children[0]!)).toBeTruthy();
  });

  it("addStackChild appends a plugin section", () => {
    const next = addStackChild(stackGroup(), { pluginId: "perf.ram", sectionLabel: "RAM" });
    expect(next.children).toHaveLength(2);
    expect(next.children[1]?.tabLabel).toBe("RAM");
  });

  it("toggleStackSectionCollapsed tracks collapsed ids", () => {
    const g = stackGroup();
    const id = g.children[0]!.id;
    expect(isStackSectionCollapsed(g, id)).toBe(false);
    const collapsed = toggleStackSectionCollapsed(g, id);
    expect(isStackSectionCollapsed(collapsed, id)).toBe(true);
    const expanded = toggleStackSectionCollapsed(collapsed, id);
    expect(isStackSectionCollapsed(expanded, id)).toBe(false);
  });

  it("renameStackChild updates section label", () => {
    const g = stackGroup();
    const id = g.children[0]!.id;
    const next = renameStackChild(g, id, "Metrics");
    expect(next.children[0]?.tabLabel).toBe("Metrics");
  });

  it("addStackSection appends nested panel section", () => {
    const next = addStackSection(stackGroup(), { sectionLabel: "Nested" });
    expect(next.children).toHaveLength(2);
    expect(next.children[1]?.tabLabel).toBe("Nested");
  });

  it("removeStackChild removes a section when more than one", () => {
    const g = addStackSection(stackGroup(), { sectionLabel: "Two" });
    const removeId = g.children[1]!.id;
    const next = removeStackChild(g, removeId);
    expect(next.children).toHaveLength(1);
  });

  it("throws when removing the last section", () => {
    const g = stackGroup();
    expect(() => removeStackChild(g, g.children[0]!.id)).toThrow(/last section/i);
  });

  it("throws when removing an unknown section id", () => {
    const g = addStackSection(stackGroup(), { sectionLabel: "Two" });
    expect(() => removeStackChild(g, "missing")).toThrow(/not found/i);
  });

  it("throws when at max section count", () => {
    let g = stackGroup();
    for (let i = 0; i < MAX_TAB_GROUP_CHILDREN - 1; i++) {
      g = addStackSection(g, { sectionLabel: `S${i}` });
    }
    expect(() => addStackSection(g, { sectionLabel: "overflow" })).toThrow(/maximum/i);
    expect(() => addStackChild(g, { pluginId: "perf.cpu", sectionLabel: "CPU" })).toThrow(
      /maximum/i,
    );
  });

  it("throws when addStackSection reuses an existing section id", () => {
    const g = stackGroup();
    const id = g.children[0]!.id;
    expect(() => addStackSection(g, { id, sectionLabel: "Dup" })).toThrow(/already exists/i);
  });

  it("throws when toggling collapse for unknown section", () => {
    expect(() => toggleStackSectionCollapsed(stackGroup(), "missing")).toThrow(/not found/i);
  });

  it("throws when renaming unknown section", () => {
    expect(() => renameStackChild(stackGroup(), "missing", "X")).toThrow(/not found/i);
  });

  it("throws when group is not vertical-stack", () => {
    const panel: DashboardGroup = { kind: "group", id: "p", showBorder: true, children: [] };
    expect(() => addStackChild(panel, { pluginId: "perf.cpu", sectionLabel: "CPU" })).toThrow(
      /vertical-stack/i,
    );
  });
});
