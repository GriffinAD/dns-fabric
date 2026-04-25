import { vi } from "vitest";

/** flowbite-svelte / motion use View Timeline APIs; jsdom omits them. */
if (typeof ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserverPoly {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.animate) {
  Element.prototype.animate = function animatePolyfill() {
    return {
      cancel: () => {},
      pause: () => {},
      play: () => {},
      reverse: () => {},
      finished: Promise.resolve(),
    } as unknown as Animation;
  };
}

/** flowbite-svelte Modal uses `<dialog>.showModal()`; jsdom omits it. */
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModalPolyfill(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function closePolyfill(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

/** jsdom URL may omit blob helpers; table export tests spy on them. */
if (typeof URL.createObjectURL !== "function") {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:mock",
  });
}
if (typeof URL.revokeObjectURL !== "function") {
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => {},
  });
}

/** jsdom has no matchMedia; Svelte motion + flowbite-svelte expect it during component import. */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
