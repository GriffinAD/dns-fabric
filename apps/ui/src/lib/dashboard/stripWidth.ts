/**
 * Shared horizontal scrollport measurement for dashboard group “no wrap” strips
 * (read view and edit view).
 *
 * The scrollport is measured with `clientWidth` (full layout width of the overflow-x container).
 * Do not add horizontal padding on that element — if you need inset, pad an inner wrapper so
 * width math and flex `gap` stay aligned and `overflow-x-auto` does not get a spurious bar.
 */

/** Tailwind `gap-2` (0.5rem) — keep in sync with nowrap strip `gap-2` classes. */
export const DASHBOARD_STRIP_GAP_2_PX = 8;

/** Tailwind `gap-1` (0.25rem) — keep in sync with nested editor strip `gap-1`. */
export const DASHBOARD_STRIP_GAP_1_PX = 4;

/**
 * Inner width to distribute across `flexChildCount` fixed-width flex children with uniform
 * `gapPx` between them. Without this, `width: (100% * span / G)` per child sums to 100% **plus**
 * `(n-1) * gap`, which triggers `overflow-x-auto` on the strip.
 */
export function flexStripDistributedWidth(
  innerContentWidth: number,
  flexChildCount: number,
  gapPx: number,
): number {
  if (flexChildCount <= 0) return Math.max(0, innerContentWidth);
  return Math.max(0, innerContentWidth - Math.max(0, flexChildCount - 1) * gapPx);
}

export function stripScrollportObserve(el: HTMLElement, onWidth: (width: number) => void): {
  destroy: () => void;
} {
  const apply = () => onWidth(Math.max(0, el.clientWidth));
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(el);
  return { destroy: () => ro.disconnect() };
}
