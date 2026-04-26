import { afterEach, describe, expect, it, vi } from "vitest";

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
  it("only includes direct-child editor tiles matching root order ids", () => {
    const zone = document.createElement("div");
    const rootA = document.createElement("div");
    rootA.setAttribute("data-testid", "editor-tile");
    rootA.setAttribute("data-tile-id", "root-a");
    const nestedWrap = document.createElement("div");
    const nestedTile = document.createElement("div");
    nestedTile.setAttribute("data-testid", "editor-tile");
    nestedTile.setAttribute("data-tile-id", "nested-x");
    nestedWrap.appendChild(nestedTile);
    zone.appendChild(rootA);
    zone.appendChild(nestedWrap);
    vi.spyOn(rootA, "getBoundingClientRect").mockReturnValue(rect(0, 0, 10, 10));
    const list = collectRootTileRectsForPaletteDrop(zone, ["root-a", "root-b"]);
    expect(list).toHaveLength(1);
    expect(list[0]!.layoutIndex).toBe(0);
  });
});

describe("shouldSuppressPaletteRootInsertPreview", () => {
  it("is true when the pointer stack hits a root-level group tile", () => {
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    const group = document.createElement("div");
    group.setAttribute("data-testid", "editor-tile");
    group.setAttribute("data-editor-group", "true");
    const inner = document.createElement("span");
    group.appendChild(inner);
    zone.appendChild(group);
    expect(shouldSuppressPaletteRootInsertPreview([inner])).toBe(true);
  });

  it("is false for a root plugin tile (no data-editor-group)", () => {
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    const tile = document.createElement("div");
    tile.setAttribute("data-testid", "editor-tile");
    const inner = document.createElement("span");
    tile.appendChild(inner);
    zone.appendChild(tile);
    expect(shouldSuppressPaletteRootInsertPreview([inner])).toBe(false);
  });

  it("is false for nested editor-tile whose parent is not the root zone", () => {
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    const wrap = document.createElement("div");
    const nested = document.createElement("div");
    nested.setAttribute("data-testid", "editor-tile");
    nested.setAttribute("data-editor-group", "true");
    const inner = document.createElement("span");
    nested.appendChild(inner);
    wrap.appendChild(nested);
    zone.appendChild(wrap);
    expect(shouldSuppressPaletteRootInsertPreview([inner])).toBe(false);
  });
});

describe("resolveEditorDropZoneFromElement", () => {
  it("returns the inner drop zone when the hit element is editor-grid-chrome", () => {
    const chrome = document.createElement("div");
    chrome.setAttribute("data-testid", "editor-grid-chrome");
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    chrome.appendChild(zone);
    expect(resolveEditorDropZoneFromElement(chrome)).toBe(zone);
  });

  it("returns the zone when the hit element is inside it", () => {
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    const span = document.createElement("span");
    zone.appendChild(span);
    expect(resolveEditorDropZoneFromElement(span)).toBe(zone);
  });

  it("returns null when the element is not under editor chrome or drop zone", () => {
    const orphan = document.createElement("div");
    expect(resolveEditorDropZoneFromElement(orphan)).toBeNull();
  });

  it("returns null when editor-grid-chrome has no inner drop zone", () => {
    const chrome = document.createElement("div");
    chrome.setAttribute("data-testid", "editor-grid-chrome");
    expect(resolveEditorDropZoneFromElement(chrome)).toBeNull();
  });
});

describe("findRootInsertIndexFromElementsFromPoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("uses geometry when the hit stack starts on editor-grid-chrome", () => {
    const chrome = document.createElement("div");
    chrome.setAttribute("data-testid", "editor-grid-chrome");
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    const tile0 = document.createElement("div");
    tile0.setAttribute("data-testid", "editor-tile");
    tile0.setAttribute("data-tile-id", "a");
    const tile1 = document.createElement("div");
    tile1.setAttribute("data-testid", "editor-tile");
    tile1.setAttribute("data-tile-id", "b");
    zone.appendChild(tile0);
    zone.appendChild(tile1);
    chrome.appendChild(zone);
    document.body.appendChild(chrome);
    vi.spyOn(tile0, "getBoundingClientRect").mockReturnValue(rect(0, 0, 400, 80));
    vi.spyOn(tile1, "getBoundingClientRect").mockReturnValue(rect(0, 100, 400, 80));
    expect(findRootInsertIndexFromElementsFromPoint(50, 90, ["a", "b"], () => [chrome])).toBe(1);
  });

  it("skips legacy layout-edit-palette in the hit stack", () => {
    const shell = document.createElement("div");
    shell.setAttribute("data-testid", "layout-edit-palette");
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    const tile0 = document.createElement("div");
    tile0.setAttribute("data-testid", "editor-tile");
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
    shell.setAttribute("data-testid", "layout-edit-palette-v2");
    const chrome = document.createElement("div");
    chrome.setAttribute("data-testid", "editor-grid-chrome");
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    const tile0 = document.createElement("div");
    tile0.setAttribute("data-testid", "editor-tile");
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
    zone.setAttribute("data-testid", "editor-drop-zone");
    const tile0 = document.createElement("div");
    tile0.setAttribute("data-testid", "editor-tile");
    tile0.setAttribute("data-tile-id", "a");
    const tile1 = document.createElement("div");
    tile1.setAttribute("data-testid", "editor-tile");
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
    zone.setAttribute("data-testid", "editor-drop-zone");
    const inner = document.createElement("span");
    zone.appendChild(inner);
    document.body.appendChild(zone);
    expect(findRootInsertIndexFromElementsFromPoint(1, 1, ["root-a"], () => [inner])).toBeUndefined();
  });

  it("falls back to stack hit-testing when rects are skipped (e.g. DnD shadow root tile only)", () => {
    const zone = document.createElement("div");
    zone.setAttribute("data-testid", "editor-drop-zone");
    const tile = document.createElement("div");
    tile.setAttribute("data-testid", "editor-tile");
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
    zone.setAttribute("data-testid", "editor-drop-zone");
    const tile = document.createElement("div");
    tile.setAttribute("data-testid", "editor-tile");
    tile.setAttribute("data-tile-id", "root-a");
    tile.setAttribute("data-is-dnd-shadow-item-internal", "");
    const inner = document.createElement("span");
    tile.appendChild(inner);
    zone.appendChild(tile);
    document.body.appendChild(zone);
    expect(findRootInsertIndexFromElementsFromPoint(1, 1, ["other-id"], () => [inner])).toBeUndefined();
  });
});
