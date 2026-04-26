/**
 * Palette uses native HTML5 drop on the editor chrome while in-grid reorder uses svelte-dnd-action.
 * Map a drop point to a **root** insertion index (insert before this index in `layout.items`), or
 * `undefined` to append.
 *
 * Geometry-based resolution matches multi-row / gap hit testing closer to in-grid DnD than the
 * legacy “first `elementsFromPoint` hit” rule (which often picked nested tiles or ignored row gaps).
 *
 * Hit stack handling: resolve the root zone from `grid-chrome` when the pointer hits the outer shell
 * where `closest(drop-zone)` fails, and skip palette DOM layers so a floating palette does not mask
 * the grid under the cursor.
 *
 * DOM resolution uses {@link ../interactions/editorDomContract} (`data-dashboard-editor`), not
 * `data-testid` alone.
 */

import {
  EDITOR_DROP_ZONE_SEL,
  EDITOR_GRID_CHROME_SEL,
  EDITOR_PALETTE_SHELL_SEL,
  EDITOR_TILE_ROW_SEL,
  isDashboardEditorTileRow,
} from "./interactions/editorDomContract";

/** True when `el` is inside the palette shell so we walk past it to grid layers below. */
function paletteHitLayer(el: Element): boolean {
  return el.closest(EDITOR_PALETTE_SHELL_SEL) != null;
}

/**
 * Resolve the root grid drop zone from a hit element.
 * Hits on grid chrome (e.g. its border box outside the inner grid) do not have the inner zone as an
 * ancestor, so `closest(drop-zone)` alone misses.
 */
export function resolveEditorDropZoneFromElement(el: Element): HTMLElement | null {
  const direct = el.closest(EDITOR_DROP_ZONE_SEL);
  if (direct instanceof HTMLElement) return direct;
  const chrome = el.closest(EDITOR_GRID_CHROME_SEL);
  if (chrome instanceof HTMLElement) {
    const inner = chrome.querySelector(EDITOR_DROP_ZONE_SEL);
    return inner instanceof HTMLElement ? inner : null;
  }
  return null;
}

/** px — expand gap / edge bands so row-gap and palette cursor slop match in-grid feel. */
const PALETTE_INSERT_GAP_MARGIN_PX = 8;

/** px — treat tiles on the same horizontal band as one row when comparing tops. */
const PALETTE_SAME_ROW_TOP_DELTA_PX = 12;

export type RootTileRectForPalette = { layoutIndex: number; rect: DOMRect };

/**
 * When the pointer is over a **root-level** container tile (direct child of the root drop zone),
 * palette drops are handled by the group's HTML5 `ondrop`, not the root canvas — suppress the
 * root insert line so we do not imply a root reorder slot.
 */
export function shouldSuppressPaletteRootInsertPreview(stack: readonly Element[]): boolean {
  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    if (paletteHitLayer(node)) continue;
    const row = node.closest(EDITOR_TILE_ROW_SEL);
    if (!(row instanceof HTMLElement)) continue;
    const zone = row.closest(EDITOR_DROP_ZONE_SEL);
    if (!(zone instanceof HTMLElement)) continue;
    if (row.parentElement !== zone) continue;
    if (row.getAttribute("data-editor-group") === "true") return true;
  }
  return false;
}

function findEditorDropZoneFromHitStack(stack: readonly Element[]): HTMLElement | null {
  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    if (paletteHitLayer(node)) continue;
    const z = resolveEditorDropZoneFromElement(node);
    if (z) return z;
  }
  return null;
}

function directChildRootTileRect(zone: HTMLElement, id: string): DOMRect | null {
  for (const child of zone.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (!isDashboardEditorTileRow(child)) continue;
    if (child.getAttribute("data-tile-id") !== id) continue;
    if (child.hasAttribute("data-is-dnd-shadow-item-internal")) continue;
    return child.getBoundingClientRect();
  }
  return null;
}

/**
 * Collect `getBoundingClientRect()` for each root list id in **layout order**, using only
 * tile-row nodes that are **direct children** of the root drop zone (skips nested tiles).
 */
export function collectRootTileRectsForPaletteDrop(
  zone: HTMLElement,
  rootOrderIds: readonly string[],
): RootTileRectForPalette[] {
  const out: RootTileRectForPalette[] = [];
  for (let i = 0; i < rootOrderIds.length; i++) {
    const r = directChildRootTileRect(zone, rootOrderIds[i]!);
    if (r) out.push({ layoutIndex: i, rect: r });
  }
  return out;
}

/**
 * Pure geometry: insertion index into `layout.items` (0…n) from pointer and root tile rects.
 * Returns `undefined` to append at the end.
 */
export function paletteRootInsertIndexFromRects(
  clientX: number,
  clientY: number,
  rects: readonly RootTileRectForPalette[],
): number | undefined {
  if (rects.length === 0) return undefined;

  const visual = [...rects].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

  const inside = (r: DOMRect) =>
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom;

  for (const e of visual) {
    if (!inside(e.rect)) continue;
    const midY = (e.rect.top + e.rect.bottom) / 2;
    const midX = (e.rect.left + e.rect.right) / 2;
    const widerThanTall = e.rect.width >= e.rect.height;
    if (widerThanTall) {
      return clientX < midX ? e.layoutIndex : e.layoutIndex + 1;
    }
    return clientY < midY ? e.layoutIndex : e.layoutIndex + 1;
  }

  const first = visual[0]!;
  if (
    clientY < first.rect.top + PALETTE_INSERT_GAP_MARGIN_PX &&
    clientX >= first.rect.left - PALETTE_INSERT_GAP_MARGIN_PX &&
    clientX <= first.rect.right + PALETTE_INSERT_GAP_MARGIN_PX
  ) {
    return first.layoutIndex;
  }

  for (let j = 0; j < visual.length - 1; j++) {
    const a = visual[j]!;
    const b = visual[j + 1]!;
    const sameRow =
      Math.abs(a.rect.top - b.rect.top) < PALETTE_SAME_ROW_TOP_DELTA_PX &&
      a.rect.right <= b.rect.left + PALETTE_SAME_ROW_TOP_DELTA_PX;
    if (sameRow) {
      const mid = (a.rect.right + b.rect.left) / 2;
      const yMin = Math.min(a.rect.top, b.rect.top) - PALETTE_INSERT_GAP_MARGIN_PX;
      const yMax = Math.max(a.rect.bottom, b.rect.bottom) + PALETTE_INSERT_GAP_MARGIN_PX;
      if (clientY >= yMin && clientY <= yMax) {
        if (clientX >= a.rect.left - PALETTE_INSERT_GAP_MARGIN_PX && clientX < mid) {
          return Math.min(a.layoutIndex, b.layoutIndex);
        }
        if (clientX >= mid && clientX <= b.rect.right + PALETTE_INSERT_GAP_MARGIN_PX) {
          return Math.max(a.layoutIndex, b.layoutIndex);
        }
      }
      continue;
    }

    const xMin = Math.min(a.rect.left, b.rect.left) - PALETTE_INSERT_GAP_MARGIN_PX;
    const xMax = Math.max(a.rect.right, b.rect.right) + PALETTE_INSERT_GAP_MARGIN_PX;
    const gapLow = Math.min(a.rect.bottom, b.rect.bottom);
    const gapHigh = Math.max(a.rect.top, b.rect.top);
    const inVerticalBand =
      clientY >= gapLow - PALETTE_INSERT_GAP_MARGIN_PX &&
      clientY <= gapHigh + PALETTE_INSERT_GAP_MARGIN_PX &&
      clientX >= xMin &&
      clientX <= xMax;
    if (inVerticalBand) {
      return b.layoutIndex;
    }
  }

  const last = visual[visual.length - 1]!;
  if (
    clientY > last.rect.bottom - PALETTE_INSERT_GAP_MARGIN_PX &&
    clientX >= last.rect.left - PALETTE_INSERT_GAP_MARGIN_PX &&
    clientX <= last.rect.right + PALETTE_INSERT_GAP_MARGIN_PX
  ) {
    return undefined;
  }

  return undefined;
}

/**
 * @param elementsFromPointImpl — hit-test stack (caller wraps `document.elementsFromPoint` for browser vs tests).
 */
export function findRootInsertIndexFromElementsFromPoint(
  clientX: number,
  clientY: number,
  rootOrderIds: readonly string[],
  elementsFromPointImpl: (x: number, y: number) => readonly Element[],
): number | undefined {
  const stack = [...elementsFromPointImpl(clientX, clientY)];
  const zone = findEditorDropZoneFromHitStack(stack);
  if (!zone) return undefined;

  const rects = collectRootTileRectsForPaletteDrop(zone, rootOrderIds);
  if (rects.length > 0) {
    return paletteRootInsertIndexFromRects(clientX, clientY, rects);
  }

  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    if (paletteHitLayer(node)) continue;
    const nz = resolveEditorDropZoneFromElement(node);
    if (!nz || nz !== zone) continue;
    const row = node.closest(EDITOR_TILE_ROW_SEL);
    const id = row?.getAttribute("data-tile-id") ?? undefined;
    if (!id || !(row instanceof HTMLElement) || row.parentElement !== zone) continue;
    const i = rootOrderIds.indexOf(id);
    if (i >= 0) return i;
  }
  return undefined;
}
