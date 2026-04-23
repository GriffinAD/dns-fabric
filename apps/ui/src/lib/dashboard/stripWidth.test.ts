import { describe, expect, it, vi } from "vitest";

import { stripScrollportObserve } from "./stripWidth";

describe("stripScrollportObserve", () => {
  it("calls onWidth with element clientWidth and disconnect stops observer", () => {
    const el = { clientWidth: 42 } as unknown as HTMLElement;
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
    expect(onWidth).toHaveBeenCalledWith(42);
    expect(observe).toHaveBeenCalledWith(el);
    destroy();
    expect(disconnect).toHaveBeenCalled();
  });
});
