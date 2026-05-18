/** Axis-aligned box in frame-local coordinates (px). */
export type OutlineRect = { x: number; y: number; w: number; h: number };

export type TabControlOutlineInput = {
  pane: OutlineRect;
  /** Active `[role=tab"]`; when missing, outline is a rounded panel rect. */
  tab: OutlineRect | null;
  paneRadius?: number;
  tabRadius?: number;
};

const DEFAULT_PANE_R = 8;
const DEFAULT_TAB_R = 2;

/** DOMRect → coordinates relative to a parent box. */
export function outlineRectRelativeTo(inner: DOMRect, outer: DOMRect): OutlineRect {
  return {
    x: inner.left - outer.left,
    y: inner.top - outer.top,
    w: inner.width,
    h: inner.height,
  };
}

/** Measure frame + pane (+ optional active tab) into an SVG outline path. */
export function measureTabControlOutline(
  frame: DOMRect,
  pane: DOMRect,
  tab: DOMRect | null,
): { path: string; viewW: number; viewH: number } | null {
  if (frame.width <= 0 || frame.height <= 0) return null;
  const paneLocal = outlineRectRelativeTo(pane, frame);
  const tabLocal = tab ? outlineRectRelativeTo(tab, frame) : null;
  return {
    path: buildTabControlOutlinePath({ pane: paneLocal, tab: tabLocal }),
    viewW: frame.width,
    viewH: frame.height,
  };
}

/** Closed SVG path: folder tab (active) + panel, or rounded panel only. */
export function buildTabControlOutlinePath(input: TabControlOutlineInput): string {
  const rP = input.paneRadius ?? DEFAULT_PANE_R;
  const rT = input.tabRadius ?? DEFAULT_TAB_R;
  const p = input.pane;
  const t = input.tab;

  if (!t || t.w <= 0 || t.h <= 0) {
    return roundedRectPath(p.x, p.y, p.w, p.h, rP);
  }

  const px = p.x;
  const py = p.y;
  const pw = p.w;
  const ph = p.h;
  const tx = t.x;
  const ty = t.y;
  const tw = t.w;
  const seamY = py;

  const parts: string[] = [];

  // Pane bottom-left → bottom → bottom-right → right → top-right.
  parts.push(`M ${px + rP} ${py + ph}`);
  parts.push(`L ${px + pw - rP} ${py + ph}`);
  parts.push(arc(px + pw - rP, py + ph, px + pw, py + ph - rP, rP));
  parts.push(`L ${px + pw} ${py + rP}`);
  parts.push(arc(px + pw, py + rP, px + pw - rP, py, rP));

  // Pane top from right edge to active tab bottom-right (open tab bottom).
  parts.push(`L ${tx + tw} ${seamY}`);

  // Active tab: right → top-right → top → top-left → left to seam.
  parts.push(`L ${tx + tw} ${ty + rT}`);
  parts.push(arc(tx + tw, ty + rT, tx + tw - rT, ty, rT));
  parts.push(`L ${tx + rT} ${ty}`);
  parts.push(arc(tx + rT, ty, tx, ty + rT, rT));
  parts.push(`L ${tx} ${seamY}`);

  // Pane top segment left of the active tab (e.g. Tab 3 active).
  if (tx > px + 0.5) {
    parts.push(`L ${px} ${seamY}`);
  }

  // Pane left → bottom-left.
  parts.push(`L ${px} ${py + ph - rP}`);
  parts.push(arc(px, py + ph - rP, px + rP, py + ph, rP));
  parts.push("Z");

  return parts.join(" ");
}

/** Convex corner for clockwise exterior loop (SVG y-down). Sweep 1 curves inward. */
function arc(x1: number, y1: number, x2: number, y2: number, r: number): string {
  return `A ${r} ${r} 0 0 0 ${x2} ${y2}`;
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    arc(x + w - rr, y, x + w, y + rr, rr),
    `L ${x + w} ${y + h - rr}`,
    arc(x + w, y + h - rr, x + w - rr, y + h, rr),
    `L ${x + rr} ${y + h}`,
    arc(x + rr, y + h, x, y + h - rr, rr),
    `L ${x} ${y + rr}`,
    arc(x, y + rr, x + rr, y, rr),
    "Z",
  ].join(" ");
}
