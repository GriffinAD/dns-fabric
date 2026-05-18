import { describe, expect, it } from "vitest";

import {
  buildTabControlOutlinePath,
  measureTabControlOutline,
  outlineRectRelativeTo,
} from "./tabControlOutline";

describe("buildTabControlOutlinePath", () => {
  const pane = { x: 0, y: 40, w: 400, h: 200 };

  it("returns a closed path for pane-only fallback", () => {
    const d = buildTabControlOutlinePath({ pane, tab: null });
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("0 0 0");
    expect(d).not.toMatch(/0 0 1/);
  });

  it("includes tab top edge when tab is flush with pane left", () => {
    const tab = { x: 0, y: 10, w: 72, h: 30 };
    const d = buildTabControlOutlinePath({ pane, tab });
    expect(d).toContain("L 72 40");
    expect(d).toContain("L 0 40");
    expect(d).not.toContain("L 0 40 L 0 40");
  });

  it("draws pane top segment left of a non-first active tab", () => {
    const tab = { x: 160, y: 10, w: 72, h: 30 };
    const d = buildTabControlOutlinePath({ pane, tab });
    expect(d).toContain("L 0 40");
    expect(d).toContain("L 160 40");
  });

  it("outlineRectRelativeTo offsets by parent origin", () => {
    const outer = { left: 10, top: 20, width: 100, height: 80 } as DOMRect;
    const inner = { left: 15, top: 25, width: 50, height: 30 } as DOMRect;
    expect(outlineRectRelativeTo(inner, outer)).toEqual({ x: 5, y: 5, w: 50, h: 30 });
  });

  it("measureTabControlOutline returns null for zero-sized frame", () => {
    const frame = { left: 0, top: 0, width: 0, height: 0 } as DOMRect;
    const pane = { left: 0, top: 0, width: 100, height: 50 } as DOMRect;
    expect(measureTabControlOutline(frame, pane, null)).toBeNull();
  });

  it("measureTabControlOutline builds path from DOM rects", () => {
    const frame = { left: 0, top: 0, width: 400, height: 240 } as DOMRect;
    const pane = { left: 0, top: 40, width: 400, height: 200 } as DOMRect;
    const tab = { left: 0, top: 10, width: 72, height: 30 } as DOMRect;
    const out = measureTabControlOutline(frame, pane, tab);
    expect(out?.viewW).toBe(400);
    expect(out?.path.startsWith("M ")).toBe(true);
  });
});
