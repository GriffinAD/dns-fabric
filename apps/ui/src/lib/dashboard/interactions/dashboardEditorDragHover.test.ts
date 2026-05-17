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
import {
  groupChildSlotContainer,
  ROOT_CANVAS_CONTAINER,
  rootRowEndContainer,
} from "./dashboardSveltedndTypes";

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
    dndState.dropPosition = null;
  });

  afterEach(() => {
    clearEditorDragHover();
    dndState.isDragging = false;
    dndState.draggedItem = null;
    dndState.targetContainer = null;
    dndState.targetElement = null;
    grid.remove();
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

  it("records and clears last editor drag client", () => {
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => drop;
    syncEditorDragHoverFromPointer(12, 34, []);
    expect(getLastEditorDragClient()).toEqual({ x: 12, y: 34 });
    clearLastEditorDragClient();
    expect(getLastEditorDragClient()).toBeNull();
    document.elementFromPoint = orig;
  });

  it("clears hover when not dragging", () => {
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => drop;
    syncEditorDragHoverFromPointer(40, 40, []);
    dndState.isDragging = false;
    syncEditorDragHoverFromPointer(40, 40, []);
    expect(getLastEditorDragClient()).toBeNull();
    expect(drop.classList.contains("svelte-dnd-drop-target")).toBe(false);
    document.elementFromPoint = orig;
  });

  it("sets dropPosition after for root row-end containers", () => {
    const rowEnd = document.createElement("div");
    rowEnd.setAttribute(DND_CONTAINER_ATTR, rootRowEndContainer("tile-a"));
    grid.appendChild(rowEnd);
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => rowEnd;
    syncEditorDragHoverFromPointer(10, 10, []);
    expect(dndState.dropPosition).toBe("after");
    document.elementFromPoint = orig;
    rowEnd.remove();
  });

  it("ignores hover sync when container id does not parse", () => {
    const bad = document.createElement("div");
    bad.setAttribute(DND_CONTAINER_ATTR, "not-a-container");
    grid.appendChild(bad);
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => bad;
    syncEditorDragHoverFromPointer(8, 8, []);
    expect(dndState.dropPosition).toBeNull();
    document.elementFromPoint = orig;
    bad.remove();
  });

  it("sets dropPosition after for root gap-after containers", () => {
    const gap = document.createElement("div");
    gap.setAttribute(DND_CONTAINER_ATTR, "r:gap:tile-a");
    grid.appendChild(gap);
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => gap;
    syncEditorDragHoverFromPointer(6, 6, []);
    expect(dndState.dropPosition).toBe("after");
    document.elementFromPoint = orig;
    gap.remove();
  });

  it("sets dropPosition after when pointer is on the right half of a root tile", () => {
    const tile = document.createElement("div");
    tile.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40 }) as DOMRect;
    const rootDrop = document.createElement("div");
    rootDrop.setAttribute(DND_CONTAINER_ATTR, "r:tile-a");
    rootDrop.appendChild(tile);
    grid.appendChild(rootDrop);
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => tile;
    syncEditorDragHoverFromPointer(80, 20, []);
    expect(dndState.dropPosition).toBe("after");
    document.elementFromPoint = orig;
    rootDrop.remove();
  });

  it("uses the hit element as targetElement when it is an Element but not HTMLElement", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    drop.appendChild(svg);
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => svg;
    syncEditorDragHoverFromPointer(40, 40, []);
    expect(dndState.targetElement).toBe(svg);
    document.elementFromPoint = orig;
    svg.remove();
  });

  it("sets dropPosition from group child tile band", () => {
    const child = document.createElement("div");
    child.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40 }) as DOMRect;
    const groupDrop = document.createElement("div");
    groupDrop.setAttribute(DND_CONTAINER_ATTR, groupChildSlotContainer("g1", "c1"));
    groupDrop.appendChild(child);
    grid.appendChild(groupDrop);
    const orig = document.elementFromPoint;
    document.elementFromPoint = () => child;
    syncEditorDragHoverFromPointer(20, 20, []);
    expect(dndState.dropPosition).toBe("before");
    document.elementFromPoint = orig;
    groupDrop.remove();
  });
});
