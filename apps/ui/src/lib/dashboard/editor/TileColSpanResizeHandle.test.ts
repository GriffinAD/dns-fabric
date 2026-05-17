import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";

import TileColSpanResizeHandle from "./TileColSpanResizeHandle.svelte";

describe("TileColSpanResizeHandle", () => {
  it("commits colSpan changes on pointer up", () => {
    const onColSpanChange = vi.fn();
    const grid = document.createElement("div");
    grid.setAttribute("data-dashboard-editor", "drop-zone");
    grid.style.width = "400px";
    document.body.appendChild(grid);

    render(TileColSpanResizeHandle, {
      target: grid,
      props: {
        colSpan: 4,
        maxTracks: 20,
        trackCount: 20,
        onColSpanChange,
      },
    });

    const handle = grid.querySelector(
      '[data-testid="editor-tile-col-resize-handle"]',
    ) as HTMLButtonElement;
    handle.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 40, height: 40 }) as DOMRect;

    fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 80, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 80, pointerId: 1 });

    expect(onColSpanChange).toHaveBeenCalled();
    const last = onColSpanChange.mock.calls.at(-1);
    expect(last?.[1]).toBe("commit");
    expect(typeof last?.[0]).toBe("number");
    grid.remove();
  });
});
