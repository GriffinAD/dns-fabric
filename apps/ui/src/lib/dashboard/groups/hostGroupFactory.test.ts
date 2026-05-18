import { describe, expect, it } from "vitest";

import { makeTabControlGroup, makeVerticalStackGroup } from "./hostGroupFactory";

describe("hostGroupFactory", () => {
  it("makeTabControlGroup seeds one nested panel tab", () => {
    const g = makeTabControlGroup("tabs-1");
    expect(g.hostControl).toBe("tab-control");
    expect(g.children).toHaveLength(1);
    expect(g.hostState?.activeChildId).toBe(g.children[0]?.id);
  });

  it("makeVerticalStackGroup seeds one section", () => {
    const g = makeVerticalStackGroup("stack-1");
    expect(g.hostControl).toBe("vertical-stack");
    expect(g.children).toHaveLength(1);
    expect(g.children[0]?.tabLabel).toBe("Section 1");
  });
});
