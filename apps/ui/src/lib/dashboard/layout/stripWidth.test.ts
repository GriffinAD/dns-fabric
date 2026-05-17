import { describe, expect, it, vi } from "vitest";

import {
  DASHBOARD_STRIP_GAP_1_PX,
  DASHBOARD_STRIP_GAP_2_PX,
  flexStripDistributedWidth,
  stripScrollportObserve,
} from "./stripWidth";

describe("flexStripDistributedWidth", () => {
  it("subtracts (n-1) * gap from inner width for n flex children", () => {
    expect(flexStripDistributedWidth(400, 4, DASHBOARD_STRIP_GAP_2_PX)).toBe(400 - 3 * 8);
    expect(flexStripDistributedWidth(100, 1, DASHBOARD_STRIP_GAP_2_PX)).toBe(100);
    expect(flexStripDistributedWidth(100, 0, DASHBOARD_STRIP_GAP_2_PX)).toBe(100);
  });

  it("supports gap-1 strips", () => {
    expect(flexStripDistributedWidth(200, 3, DASHBOARD_STRIP_GAP_1_PX)).toBe(200 - 2 * 4);
  });
});

describe("stripScrollportObserve", () => {
  it("calls onWidth with clientWidth and disconnect stops observer", () => {
    const el = { clientWidth: 50 } as unknown as HTMLElement;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observe;
        disconnect = disconnect;
        constructor(public cb: () => void) {
          void this.cb;
        }
      },
    );
    const onWidth = vi.fn();
    const { destroy } = stripScrollportObserve(el, onWidth);
    expect(onWidth).toHaveBeenCalledWith(50);
    expect(observe).toHaveBeenCalledWith(el);
    destroy();
    expect(disconnect).toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
