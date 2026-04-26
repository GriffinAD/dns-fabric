import { afterEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_EDITOR_ATTR } from "./interactions/editorDomContract";
import {
  collectRootTileRectsForPaletteDrop,
  findRootInsertIndexFromElementsFromPoint,
  paletteRootInsertIndexFromRects,
  resolveEditorDropZoneFromElement,
  shouldSuppressPaletteRootInsertPreview,
} from "./paletteDropInsertIndex";

function rect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON() {
      return "";
    },
  } as DOMRect;
}

function setEditorSurface(el: HTMLElement, surface: string) {
  el.setAttribute(DASHBOARD_EDITOR_ATTR, surface);
}

describe("paletteRootInsertIndexFromRects", () => {
  it("returns lower layout index when pointer sits in a vertical gap between stacked rows", () => {
    const rects = [
      { layoutIndex: 0, rect: rect(0, 0, 400, 80) },
      { layoutIndex: 1, rect: rect(0, 100, 400, 80) },
    ];
    expect(paletteRootInsertIndexFromRects(200, 90, rects)).toBe(1);
  });

  it("returns append (undefined) when pointer is clearly below the last row", () => {
    const rects = [
      { layoutIndex: 0, rect: rect(0, 0, 400, 80) },
      { layoutIndex: 1, rect: rect(0, 100, 400, 80) },
    ];
    expect(paletteRootInsertIndexFromRects(200, 200, rects)).toBeUndefined();
  });

  it("inserts before first when pointer is above the first tile", () => {
    const rects = [{ layoutIndex: 2, rect: rect(0, 50, 400, 80) }];
    expect(paletteRootInsertIndexFromRects(200, 40, rects)).toBe(2);
  });

  it("splits a wide tile horizontally at the midpoint", () => {
    const rects = [{ layoutIndex: 0, rect: rect(0, 0, 400, 60) }];
    expect(paletteRootInsertIndexFromRects(100, 30, rects)).toBe(0);
    expect(paletteRootInsertIndexFromRects(300, 30, rects)).toBe(1);
  });

  it("splits a tall tile vertically at the midpoint", () => {
    const rects = [{ layoutIndex: 0, rect: rect(0, 0, 120, 400) }];
    expect(paletteRootInsertIndexFromRects(60, 100, rects)).toBe(0);
    expect(paletteRootInsertIndexFromRects(60, 300, rects)).toBe(1);
  });

  it("returns undefined when there are no rects", () => {
    expect(paletteRootInsertIndexFromRects(0, 0, [])).toBeUndefined();
  });

  it("resolves horizontal gap between two tiles on the same row", () => {
    const rects = [
      { layoutIndex: 0, rect: rect(0, 0, 180, 40) },
      { layoutIndex: 1, rect: rect(200, 0, 180, 40) },
    ];
    expect(paletteRootInsertIndexFromRects(185, 20, rects)).toBe(0);
    expect(paletteRootInsertIndexFromRects(195, 20, rects)).toBe(1);
  });

  it("ignores same-row pair when the pointer is on the row band but outside horizontal split margins", () => {
    const rects = [
      { layoutIndex: 0, rect: rect(0, 0, 180, 40) },
      { layoutIndex: 1, rect: rect(200, 0, 180, 40) },
    ];
    expect(paletteRootInsertIndexFromRects(-50, 20, rects)).toBeUndefined();
  });

  it("returns undefined when the pointer is below the last row inside the column band", () => {
    const rects = [
      { layoutIndex: 0, rect: rect(0, 0, 400, 80) },
      { layoutIndex: 1, rect: rect(0, 100, 400, 80) },
    ];
    expect(paletteRootInsertIndexFromRects(50, 185, rects)).toBeUndefined();
  });

  it("returns undefined when the pointer is outside the column band but not in any gap (fall-through)", () => {
    const rects = [{ layoutIndex: 0, rect: rect(0, 0, 400, 80) }];
    expect(paletteRootInsertIndexFromRects(500, 40, rects)).toBeUndefined();
  });
});

describe("collectRootTileRectsForPaletteDrop", () => {
  it("skips non-HTMLElement element children when collecting rects (e.g. SVG)", () => {
    const zone = document.createElement("div");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const rootA = document.createElement("div");
    setEditorSurface(rootA, "tile-row");
    rootA.setAttribute("data-tile-id", "root-a");
    zone.appendChild(svg);
    zone.appendChild(rootA);
    vi.spyOn(rootA, "getBoundingClientRect").mockReturnValue(rect(0, 0, 10, 10));
    const list = collectRootTileRectsForPaletteDrop(zone, ["root-a"]);
    expect(list).toHaveLength(1);
  });

  it("only includes direct-child editor tiles matching root order ids", () => {
    const zone = document.createElement("div");
    const rootA = document.createElement("div");
    setEditorSurface(rootA, "tile-row");
    rootA.setAttribute("data-tile-id", "root-a");
    const nestedWrap = document.createElement("div");
    const nestedTile = document.createElement("div");
    setEditorSurface(nestedTile, "tile-row");
    nestedTile.setAttribute("data-tile-id", "nested-x");
    nestedWrap.appendChild(nestedTile);
    zone.appendChild(rootA);
    zone.appendChild(nestedWrap);
    vi.spyOn(rootA, "getBoundingClientRect").mockReturnValue(rect(0, 0, 10, 10));
    const list = collectRootTileRectsForPaletteDrop(zone, ["root-a", "root-b"]);
    expect(list).toHaveLength(1);
    expect(list[0]!.layoutIndex).toBe(0);
  });

  it("skips direct child tile rows marked as dnd shadow when collecting rects", () => {
    const zone = document.createElement("div");
    const rootA = document.createElement("div");
    setEditorSurface(rootA, "tile-row");
    rootA.setAttribute("data-tile-id", "root-a");
    rootA.setAttribute("data-is-dnd-shadow-item-internal", "");
    const rootB = document.createElement("div");
    setEditorSurface(rootB, "tile-row");
    rootB.setAttribute("data-tile-id", "root-b");
    zone.appendChild(rootA);
    zone.appendChild(rootB);
    vi.spyOn(rootB, "getBoundingClientRect").mockReturnValue(rect(0, 0, 10, 10));
    const list = collectRootTileRectsForPaletteDrop(zone, ["root-a", "root-b"]);
    expect(list).toHaveLength(1);
    expect(list[0]!.layoutIndex).toBe(1);
  });
});

describe("shouldSuppressPaletteRootInsertPreview", () => {
  it("skips palette shell nodes before resolving a root-level group tile", () => {
    const shell = document.createElement("div");
    setEditorSurface(shell, "palette");
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const group = document.createElement("div");
    setEditorSurface(group, "tile-row");
    group.setAttribute("data-editor-group", "true");
    const inner = document.createElement("span");
    group.appendChild(inner);
    zone.appendChild(group);
    expect(shouldSuppressPaletteRootInsertPreview([shell, inner])).toBe(true);
  });

  it("is true when the pointer stack hits a root-level group tile", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const group = document.createElement("div");
    setEditorSurface(group, "tile-row");
    group.setAttribute("data-editor-group", "true");
    const inner = document.createElement("span");
    group.appendChild(inner);
    zone.appendChild(group);
    expect(shouldSuppressPaletteRootInsertPreview([inner])).toBe(true);
  });

  it("is false for a root plugin tile (no data-editor-group)", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const tile = document.createElement("div");
    setEditorSurface(tile, "tile-row");
    const inner = document.createElement("span");
    tile.appendChild(inner);
    zone.appendChild(tile);
    expect(shouldSuppressPaletteRootInsertPreview([inner])).toBe(false);
  });

  it("skips non-Element nodes before resolving a group tile row", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const group = document.createElement("div");
    setEditorSurface(group, "tile-row");
    group.setAttribute("data-editor-group", "true");
    const inner = document.createElement("span");
    group.appendChild(inner);
    zone.appendChild(group);
    expect(shouldSuppressPaletteRootInsertPreview([document.createComment(""), inner])).toBe(true);
  });

  it("continues when the resolved root drop zone is not an HTMLElement", () => {
    const svgZone = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgZone.setAttribute(DASHBOARD_EDITOR_ATTR, "drop-zone");
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    const wrap = document.createElement("div");
    const row = document.createElement("div");
    setEditorSurface(row, "tile-row");
    row.setAttribute("data-editor-group", "true");
    wrap.appendChild(row);
    fo.appendChild(wrap);
    svgZone.appendChild(fo);
    document.body.appendChild(svgZone);
    try {
      expect(shouldSuppressPaletteRootInsertPreview([row])).toBe(false);
    } finally {
      svgZone.remove();
    }
  });

  it("ignores tile-row hit that is not an HTMLElement (e.g. SVG element)", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const gEl = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gEl.setAttribute(DASHBOARD_EDITOR_ATTR, "tile-row");
    gEl.setAttribute("data-editor-group", "true");
    zone.appendChild(gEl);
    expect(shouldSuppressPaletteRootInsertPreview([gEl])).toBe(false);
  });

  it("is false for nested tile-row whose parent is not the root zone", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const wrap = document.createElement("div");
    const nested = document.createElement("div");
    setEditorSurface(nested, "tile-row");
    nested.setAttribute("data-editor-group", "true");
    const inner = document.createElement("span");
    nested.appendChild(inner);
    wrap.appendChild(nested);
    zone.appendChild(wrap);
    expect(shouldSuppressPaletteRootInsertPreview([inner])).toBe(false);
  });
});

describe("resolveEditorDropZoneFromElement", () => {
  it("returns the inner drop zone when the hit element is grid chrome", () => {
    const chrome = document.createElement("div");
    setEditorSurface(chrome, "grid-chrome");
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    chrome.appendChild(zone);
    expect(resolveEditorDropZoneFromElement(chrome)).toBe(zone);
  });

  it("returns the zone when the hit element is inside it", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const span = document.createElement("span");
    zone.appendChild(span);
    expect(resolveEditorDropZoneFromElement(span)).toBe(zone);
  });

  it("returns null when the element is not under editor chrome or drop zone", () => {
    const orphan = document.createElement("div");
    expect(resolveEditorDropZoneFromElement(orphan)).toBeNull();
  });

  it("returns null when grid chrome has no inner drop zone", () => {
    const chrome = document.createElement("div");
    setEditorSurface(chrome, "grid-chrome");
    expect(resolveEditorDropZoneFromElement(chrome)).toBeNull();
  });

  it("returns null when closest drop zone match is not an HTMLElement (e.g. SVG)", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute(DASHBOARD_EDITOR_ATTR, "drop-zone");
    svg.appendChild(r);
    expect(resolveEditorDropZoneFromElement(r)).toBeNull();
  });

  it("returns null when grid chrome querySelector finds a non-HTMLElement drop zone", () => {
    const chrome = document.createElement("div");
    setEditorSurface(chrome, "grid-chrome");
    const bogus = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bogus.setAttribute(DASHBOARD_EDITOR_ATTR, "drop-zone");
    chrome.appendChild(bogus);
    expect(resolveEditorDropZoneFromElement(chrome)).toBeNull();
  });
});

describe("findRootInsertIndexFromElementsFromPoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("uses geometry when the hit stack starts on grid chrome", () => {
    const chrome = document.createElement("div");
    setEditorSurface(chrome, "grid-chrome");
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const tile0 = document.createElement("div");
    setEditorSurface(tile0, "tile-row");
    tile0.setAttribute("data-tile-id", "a");
    const tile1 = document.createElement("div");
    setEditorSurface(tile1, "tile-row");
    tile1.setAttribute("data-tile-id", "b");
    zone.appendChild(tile0);
    zone.appendChild(tile1);
    chrome.appendChild(zone);
    document.body.appendChild(chrome);
    vi.spyOn(tile0, "getBoundingClientRect").mockReturnValue(rect(0, 0, 400, 80));
    vi.spyOn(tile1, "getBoundingClientRect").mockReturnValue(rect(0, 100, 400, 80));
    expect(findRootInsertIndexFromElementsFromPoint(50, 90, ["a", "b"], () => [chrome])).toBe(1);
  });

  it("skips palette shell in the hit stack", () => {
    const shell = document.createElement("div");
    setEditorSurface(shell, "palette");
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const tile0 = document.createElement("div");
    setEditorSurface(tile0, "tile-row");
    tile0.setAttribute("data-tile-id", "a");
    zone.appendChild(tile0);
    document.body.appendChild(zone);
    vi.spyOn(tile0, "getBoundingClientRect").mockReturnValue(rect(0, 0, 400, 80));
    const inner = document.createElement("span");
    tile0.appendChild(inner);
    expect(findRootInsertIndexFromElementsFromPoint(100, 40, ["a"], () => [shell, inner])).toBe(0);
  });

  it("skips palette shells in the hit stack so the grid beneath still resolves", () => {
    const shell = document.createElement("div");
    setEditorSurface(shell, "palette");
    const chrome = document.createElement("div");
    setEditorSurface(chrome, "grid-chrome");
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const tile0 = document.createElement("div");
    setEditorSurface(tile0, "tile-row");
    tile0.setAttribute("data-tile-id", "a");
    zone.appendChild(tile0);
    chrome.appendChild(zone);
    document.body.appendChild(shell);
    document.body.appendChild(chrome);
    vi.spyOn(tile0, "getBoundingClientRect").mockReturnValue(rect(0, 0, 400, 80));
    const inner = document.createElement("span");
    tile0.appendChild(inner);
    expect(findRootInsertIndexFromElementsFromPoint(100, 40, ["a"], () => [shell, inner])).toBe(0);
  });

  it("uses geometry when the drop zone is found from the hit stack", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const tile0 = document.createElement("div");
    setEditorSurface(tile0, "tile-row");
    tile0.setAttribute("data-tile-id", "a");
    const tile1 = document.createElement("div");
    setEditorSurface(tile1, "tile-row");
    tile1.setAttribute("data-tile-id", "b");
    zone.appendChild(tile0);
    zone.appendChild(tile1);
    document.body.appendChild(zone);
    vi.spyOn(tile0, "getBoundingClientRect").mockReturnValue(rect(0, 0, 400, 80));
    vi.spyOn(tile1, "getBoundingClientRect").mockReturnValue(rect(0, 100, 400, 80));
    const inner = document.createElement("span");
    tile1.appendChild(inner);
    expect(findRootInsertIndexFromElementsFromPoint(50, 90, ["a", "b"], () => [inner])).toBe(1);
  });

  it("returns undefined when stack misses drop zone", () => {
    expect(findRootInsertIndexFromElementsFromPoint(0, 0, ["a"], () => [document.body])).toBeUndefined();
  });

  it("uses stack walk when no direct root tiles expose rects (e.g. ids not yet mounted)", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const inner = document.createElement("span");
    zone.appendChild(inner);
    document.body.appendChild(zone);
    expect(findRootInsertIndexFromElementsFromPoint(1, 1, ["root-a"], () => [inner])).toBeUndefined();
  });

  it("falls back to stack hit-testing when rects are skipped (e.g. DnD shadow root tile only)", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const tile = document.createElement("div");
    setEditorSurface(tile, "tile-row");
    tile.setAttribute("data-tile-id", "root-a");
    tile.setAttribute("data-is-dnd-shadow-item-internal", "");
    const inner = document.createElement("span");
    tile.appendChild(inner);
    zone.appendChild(tile);
    document.body.appendChild(zone);
    expect(findRootInsertIndexFromElementsFromPoint(1, 1, ["root-a", "root-b"], () => [inner])).toBe(0);
  });

  it("returns undefined when rects are empty and hit tile id is not in root order", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const tile = document.createElement("div");
    setEditorSurface(tile, "tile-row");
    tile.setAttribute("data-tile-id", "root-a");
    tile.setAttribute("data-is-dnd-shadow-item-internal", "");
    const inner = document.createElement("span");
    tile.appendChild(inner);
    zone.appendChild(tile);
    document.body.appendChild(zone);
    expect(findRootInsertIndexFromElementsFromPoint(1, 1, ["other-id"], () => [inner])).toBeUndefined();
  });

  it("ignores non-Element entries in the hit stack", () => {
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    document.body.appendChild(zone);
    const text = document.createTextNode("x");
    try {
      expect(findRootInsertIndexFromElementsFromPoint(1, 1, ["a"], () => [text, zone])).toBeUndefined();
    } finally {
      zone.remove();
    }
  });

  it("skips palette shell nodes in empty-rect stack walk", () => {
    const shell = document.createElement("div");
    setEditorSurface(shell, "palette");
    const zone = document.createElement("div");
    setEditorSurface(zone, "drop-zone");
    const inner = document.createElement("span");
    zone.appendChild(inner);
    document.body.appendChild(zone);
    try {
      expect(findRootInsertIndexFromElementsFromPoint(1, 1, ["x"], () => [shell, inner])).toBeUndefined();
    } finally {
      zone.remove();
    }
  });

  it("continues stack walk when a node resolves to a different drop zone than the first", () => {
    const zoneA = document.createElement("div");
    setEditorSurface(zoneA, "drop-zone");
    const span = document.createElement("span");
    zoneA.appendChild(span);
    const zoneB = document.createElement("div");
    setEditorSurface(zoneB, "drop-zone");
    document.body.appendChild(zoneA);
    document.body.appendChild(zoneB);
    try {
      expect(findRootInsertIndexFromElementsFromPoint(1, 1, ["missing"], () => [span, zoneB])).toBeUndefined();
    } finally {
      zoneA.remove();
      zoneB.remove();
    }
  });
});
