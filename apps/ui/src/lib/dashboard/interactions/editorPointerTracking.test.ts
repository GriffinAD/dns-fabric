import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from "vitest";

import * as hover from "./dashboardEditorDragHover";
import {
  attachEditorPointerTracking,
  type EditorPointerTrackingHandlers,
} from "./editorPointerTracking";

function dragEvent(type: string, clientX: number, clientY: number): DragEvent {
  const e = new Event(type, { bubbles: true }) as DragEvent;
  Object.defineProperty(e, "clientX", { value: clientX });
  Object.defineProperty(e, "clientY", { value: clientY });
  e.preventDefault = vi.fn();
  return e;
}

describe("attachEditorPointerTracking", () => {
  beforeAll(() => {
    if (typeof PointerEvent === "undefined") {
      globalThis.PointerEvent = class extends MouseEvent {
        declare pointerId: number;
        declare pointerType: string;
        constructor(type: string, init?: PointerEventInit) {
          super(type, init);
          this.pointerId = init?.pointerId ?? 0;
          this.pointerType = init?.pointerType ?? "";
        }
      } as typeof PointerEvent;
    }
  });

  let handlers: EditorPointerTrackingHandlers;

  beforeEach(() => {
    handlers = {
      onPointer: vi.fn(),
      onDragOver: vi.fn(),
      onDragEnd: vi.fn(),
    };
    vi.spyOn(hover, "syncEditorDragHoverFromPointer").mockImplementation(() => {});
    vi.spyOn(hover, "clearEditorDragHover").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes onPointer on pointermove while active", () => {
    const release = attachEditorPointerTracking(true, handlers);
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 20 }));
    expect(handlers.onPointer).toHaveBeenCalledWith({ x: 10, y: 20 });
    release();
  });

  it("syncs hover when getDndRoot is provided", () => {
    const getDndRoot = vi.fn(() => []);
    const release = attachEditorPointerTracking(true, handlers, { getDndRoot });
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 3, clientY: 4 }));
    expect(getDndRoot).toHaveBeenCalled();
    expect(hover.syncEditorDragHoverFromPointer).toHaveBeenCalledWith(3, 4, []);
    release();
  });

  it("handles dragover, grid preventDefault, and dragend", () => {
    const grid = document.createElement("div");
    grid.setAttribute("data-dashboard-editor", "grid-chrome");
    document.body.appendChild(grid);
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => grid;

    const release = attachEditorPointerTracking(true, handlers, { getDndRoot: () => [] });
    const over = dragEvent("dragover", 8, 9);
    document.dispatchEvent(over);
    expect(handlers.onPointer).toHaveBeenCalledWith({ x: 8, y: 9 });
    expect(over.preventDefault).toHaveBeenCalled();
    expect(handlers.onDragOver).toHaveBeenCalledWith(over);

    document.dispatchEvent(dragEvent("dragover", 0, 0));
    expect(handlers.onPointer).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("dragend", { bubbles: true }));
    expect(hover.clearEditorDragHover).toHaveBeenCalled();
    expect(handlers.onDragEnd).toHaveBeenCalled();

    release();
    document.elementFromPoint = orig;
    grid.remove();
  });

  it("release removes listeners and clears hover", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const release = attachEditorPointerTracking(true, handlers);
    release();
    expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("dragover", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("dragend", expect.any(Function), true);
    expect(hover.clearEditorDragHover).toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it("does not attach listeners when inactive", () => {
    const spy = vi.spyOn(document, "addEventListener");
    const release = attachEditorPointerTracking(false, handlers);
    expect(spy).not.toHaveBeenCalled();
    release();
    spy.mockRestore();
  });
});
