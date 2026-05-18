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
  it("retries when clientWidth is zero until layout reports width", () => {
    let width = 0;
    const el = { get clientWidth() { return width; } } as HTMLElement;
    const raf = vi.fn((cb: FrameRequestCallback) => {
      width = 120;
      cb(0);
    });
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const observe = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observe;
        disconnect = vi.fn();
        constructor(public cb: () => void) {
          void this.cb;
        }
      },
    );
    const onWidth = vi.fn();
    stripScrollportObserve(el, onWidth);
    expect(raf).toHaveBeenCalled();
    expect(onWidth).toHaveBeenCalledWith(120);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("re-measures when ResizeObserver reports a size change", () => {
    let width = 50;
    const el = { get clientWidth() { return width; } } as HTMLElement;
    let roCb: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(cb: () => void) {
          roCb = cb;
        }
      },
    );
    const onWidth = vi.fn();
    stripScrollportObserve(el, onWidth);
    expect(onWidth).toHaveBeenCalledWith(50);
    width = 88;
    roCb!();
    expect(onWidth).toHaveBeenLastCalledWith(88);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("cancels a pending animation frame when destroyed before measure", () => {
    const el = { clientWidth: 0 } as HTMLElement;
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", () => 99);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(public cb: () => void) {
          void this.cb;
        }
      },
    );
    const { destroy } = stripScrollportObserve(el, vi.fn());
    destroy();
    expect(cancel).toHaveBeenCalledWith(99);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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
