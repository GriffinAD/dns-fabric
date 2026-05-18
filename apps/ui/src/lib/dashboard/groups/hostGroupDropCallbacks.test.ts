import { describe, expect, it, vi } from "vitest";

import { createHostGroupStripDropCallbacks, isPaletteDragPayload } from "./hostGroupDropCallbacks";

describe("hostGroupDropCallbacks", () => {
  it("detects palette drag payloads", () => {
    expect(isPaletteDragPayload({ k: "pp", i: "perf.cpu" })).toBe(true);
    expect(isPaletteDragPayload({ k: "pgt" })).toBe(true);
    expect(isPaletteDragPayload({ k: "tt", g: "g", i: "t" })).toBe(false);
  });

  it("delegates palette drops to layoutDropCb", () => {
    const onDrop = vi.fn();
    const onDragOver = vi.fn();
    const onDragEnd = vi.fn();
    const cb = createHostGroupStripDropCallbacks({ onDrop, onDragOver, onDragEnd });
    const state = {
      draggedItem: { k: "pp", i: "dhcp.clients" },
      invalidDrop: true,
    } as import("@thisux/sveltednd").DragDropState<import("../interactions/dashboardSveltedndTypes").DashboardDragPayload>;
    cb.onDragOver(state);
    expect(state.invalidDrop).toBe(false);
    expect(onDragOver).toHaveBeenCalled();
    cb.onDrop(state);
    expect(onDrop).toHaveBeenCalled();
    cb.onDragEnd(state);
    expect(onDragEnd).toHaveBeenCalled();
  });

  it("routes tab reorder drops to onLocalDrop", () => {
    const onLocalDrop = vi.fn();
    const cb = createHostGroupStripDropCallbacks(undefined, onLocalDrop);
    const state = {
      draggedItem: { k: "tt", g: "tabs-1", i: "t1" },
      invalidDrop: false,
    } as import("@thisux/sveltednd").DragDropState<import("../interactions/dashboardSveltedndTypes").DashboardDragPayload>;
    cb.onDragOver(state);
    expect(state.invalidDrop).toBe(false);
    cb.onDrop(state);
    expect(onLocalDrop).toHaveBeenCalledWith(state);
  });
});
