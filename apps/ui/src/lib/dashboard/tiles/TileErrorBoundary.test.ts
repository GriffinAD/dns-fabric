import { describe, expect, it } from "vitest";
import { mount, tick, unmount } from "svelte";

import TileErrorBoundaryHarness from "./TileErrorBoundary.harness.svelte";

describe("TileErrorBoundary", () => {
  it("renders children when the tile does not throw", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = mount(TileErrorBoundaryHarness, { target: el, props: { crash: false } });
    expect(el.querySelector('[data-testid="boundary-ok"]')?.textContent).toBe("ok");
    unmount(app);
    el.remove();
  });

  it("renders error fallback when the tile throws", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = mount(TileErrorBoundaryHarness, { target: el, props: { crash: true } });
    await tick();
    const fb = el.querySelector('[data-testid="tile-fallback"][data-fallback-reason="error"]');
    expect(fb).toBeTruthy();
    expect(fb?.textContent).toContain("vitest.tile");
    unmount(app);
    el.remove();
  });
});
