import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyDashboardDragLift,
  createDashboardEditorTransformDragged,
  dashboardEditorDropTargetStyle,
  dashboardEditorNestedFlipMs,
  dashboardEditorRootFlipMs,
  preferSlotVisibilityForDndListItem,
  readPrefersReducedMotion,
} from "./dndEditorFeedback";

describe("readPrefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(readPrefersReducedMotion()).toBe(false);
  });

  it("returns false when matchMedia is missing", () => {
    vi.stubGlobal("window", { matchMedia: undefined });
    expect(readPrefersReducedMotion()).toBe(false);
  });

  it("returns true when reduce motion media query matches", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
    });
    expect(readPrefersReducedMotion()).toBe(true);
  });

  it("returns false when reduce motion media query does not match", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    expect(readPrefersReducedMotion()).toBe(false);
  });
});

describe("dashboardEditorRootFlipMs", () => {
  it("uses zero flip when reduced motion is requested", () => {
    expect(dashboardEditorRootFlipMs(true)).toBe(0);
  });

  it("uses default flip duration otherwise", () => {
    expect(dashboardEditorRootFlipMs(false)).toBe(180);
  });
});

describe("dashboardEditorNestedFlipMs", () => {
  it("is always zero", () => {
    expect(dashboardEditorNestedFlipMs()).toBe(0);
  });
});

describe("dashboardEditorDropTargetStyle", () => {
  it("returns dashed primary outline for drop affordance", () => {
    const s = dashboardEditorDropTargetStyle();
    expect(s.outline).toContain("dashed");
    expect(s.outline).toContain("var(--color-primary-500)");
    expect(s.outlineOffset).toBe("3px");
    expect(s.borderRadius).toBe("0.375rem");
  });
});

describe("preferSlotVisibilityForDndListItem", () => {
  it("is true for a DnD row whose item is a group", () => {
    expect(
      preferSlotVisibilityForDndListItem({
        id: "g1",
        item: { kind: "group", id: "g1", showBorder: true, innerWrap: false, children: [] },
      }),
    ).toBe(true);
  });

  it("is false for a plugin tile row", () => {
    expect(
      preferSlotVisibilityForDndListItem({
        id: "t1",
        item: {
          id: "t1",
          pluginId: "perf.cpu",
          hostControl: "single-panel",
          displayMode: "full",
        },
      }),
    ).toBe(false);
  });

  it("is false for non-row payloads", () => {
    expect(preferSlotVisibilityForDndListItem(undefined)).toBe(false);
    expect(preferSlotVisibilityForDndListItem({ id: "x" })).toBe(false);
  });
});

describe("createDashboardEditorTransformDragged", () => {
  it("delegates to applyDashboardDragLift with slot visibility for groups", () => {
    const el = document.createElement("div");
    createDashboardEditorTransformDragged(false)(el, {
      id: "g1",
      item: { kind: "group", id: "g1", showBorder: true, innerWrap: false, children: [] },
    });
    expect(el.style.opacity).toBe("0.86");
  });
});

describe("applyDashboardDragLift", () => {
  it("no-ops when element is undefined", () => {
    expect(() => applyDashboardDragLift(undefined, false)).not.toThrow();
  });

  it("uses light styling when reduced motion is on", () => {
    const el = document.createElement("div");
    applyDashboardDragLift(el, true);
    expect(el.style.opacity).toBe("0.98");
    expect(el.style.boxShadow).toBe("");
  });

  it("applies lift shadow when motion is allowed", () => {
    const el = document.createElement("div");
    applyDashboardDragLift(el, false);
    expect(el.style.opacity).toBe("0.94");
    expect(el.style.boxShadow).toContain("rgba");
    expect(el.style.borderRadius).toBe("0.375rem");
  });

  it("uses a slightly more transparent ghost when preferSlotVisibility is set", () => {
    const el = document.createElement("div");
    applyDashboardDragLift(el, false, { preferSlotVisibility: true });
    expect(el.style.opacity).toBe("0.86");
  });

  it("still respects reduced motion when preferSlotVisibility is set", () => {
    const el = document.createElement("div");
    applyDashboardDragLift(el, true, { preferSlotVisibility: true });
    expect(el.style.opacity).toBe("0.96");
  });
});
