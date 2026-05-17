import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { dndState } from "@thisux/sveltednd";

import {
  clearEditorDragHover,
  clearLastEditorDragClient,
  DND_CONTAINER_ATTR,
  EDITOR_DROP_HOVER_CLASSES,
  getLastEditorDragClient,
  syncEditorDragHoverFromPointer,
} from "./dashboardEditorDragHover";
import { ROOT_CANVAS_CONTAINER } from "./dashboardSveltedndTypes";

describe("dashboardEditorDragHover", () => {
  let grid: HTMLDivElement;
  let drop: HTMLDivElement;

  beforeEach(() => {
    grid = document.createElement("div");
    grid.setAttribute("data-dashboard-editor", "grid-chrome");
    drop = document.createElement("div");
    drop.setAttribute(DND_CONTAINER_ATTR, ROOT_CANVAS_CONTAINER);
    drop.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 120,
        width: 200,
        height: 120,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    grid.appendChild(drop);
    document.body.appendChild(grid);
    dndState.isDragging = true;
    dndState.draggedItem = { k: "pp", i: "demo" };
  });

  afterEach(() => {
    clearEditorDragHover();
    dndState.isDragging = false;
    dndState.draggedItem = null;
    dndState.targetContainer = null;
    dndState.targetElement = null;
    grid.remove();
  });

  it("tracks and clears the last drag pointer position", () => {
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => drop;
    try {
      syncEditorDragHoverFromPointer(12, 34, []);
      expect(getLastEditorDragClient()).toEqual({ x: 12, y: 34 });
      clearLastEditorDragClient();
      expect(getLastEditorDragClient()).toBeNull();
    } finally {
      document.elementFromPoint = orig;
    }
  });

  it("applies drop-target classes and targetContainer under the pointer", () => {
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => drop;
    try {
      syncEditorDragHoverFromPointer(40, 40, []);
      expect(dndState.targetContainer).toBe(ROOT_CANVAS_CONTAINER);
      expect(drop.classList.contains("svelte-dnd-drop-target")).toBe(true);
      for (const cls of EDITOR_DROP_HOVER_CLASSES) {
        expect(drop.classList.contains(cls)).toBe(true);
      }
    } finally {
      document.elementFromPoint = orig;
    }
  });

  it("clears hover state when the pointer leaves droppables", () => {
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => drop;
    syncEditorDragHoverFromPointer(40, 40, []);
    document.elementFromPoint = () => document.body;
    syncEditorDragHoverFromPointer(4, 4, []);
    expect(dndState.targetContainer).toBeNull();
    expect(drop.classList.contains("svelte-dnd-drop-target")).toBe(false);
    document.elementFromPoint = orig;
  });

  it("no-ops when not dragging", () => {
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => drop;
    dndState.isDragging = false;
    try {
      syncEditorDragHoverFromPointer(40, 40, []);
      expect(dndState.targetContainer).toBeNull();
      expect(drop.classList.contains("svelte-dnd-drop-target")).toBe(false);
    } finally {
      document.elementFromPoint = orig;
    }
  });

  it("sets dropPosition to after for row-end and gap-after slots", () => {
    drop.setAttribute(DND_CONTAINER_ATTR, "r:end:t1");
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => drop;
    try {
      syncEditorDragHoverFromPointer(40, 40, []);
      expect(dndState.dropPosition).toBe("after");
    } finally {
      document.elementFromPoint = orig;
    }
  });

  it("sets dropPosition from horizontal band on root tile slots", () => {
    drop.setAttribute(DND_CONTAINER_ATTR, "r:t1");
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => drop;
    try {
      syncEditorDragHoverFromPointer(190, 40, []);
      expect(dndState.dropPosition).toBe("after");
    } finally {
      document.elementFromPoint = orig;
    }
  });

  it("uses the droppable element when the hit target is not an HTMLElement", () => {
    const svgHit = document.createElementNS("http://www.w3.org/2000/svg", "g");
    drop.appendChild(svgHit);
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => svgHit;
    try {
      syncEditorDragHoverFromPointer(40, 40, []);
      expect(dndState.targetElement).toBe(drop);
    } finally {
      document.elementFromPoint = orig;
    }
  });
});
