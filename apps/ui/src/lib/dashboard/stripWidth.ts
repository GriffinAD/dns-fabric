/**
 * Shared horizontal scrollport measurement for dashboard group “no wrap” strips
 * (read view and edit view).
 */
export function stripScrollportObserve(el: HTMLElement, onWidth: (width: number) => void): {
  destroy: () => void;
} {
  const apply = () => onWidth(el.clientWidth);
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(el);
  return { destroy: () => ro.disconnect() };
}
