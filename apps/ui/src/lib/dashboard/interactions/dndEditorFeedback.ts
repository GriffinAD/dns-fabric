/**
 * Visual / timing feedback for dashboard layout editor DnD (svelte-dnd-action).
 * Placement semantics stay in `groupDndFinalize` / `layoutStore`; this module is presentation only.
 */

/** Read OS “reduce motion” preference (false in SSR or when matchMedia is missing). */
export function readPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  return Boolean(mq?.matches);
}

/**
 * FLIP duration for the **root** editor grid. Nested inner zones keep `0` to limit layout thrash.
 */
export function dashboardEditorRootFlipMs(reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return 180;
}

/**
 * Nested `dragHandleZone` instances (groups / innerWrap / nowrap strips) use **0** ms flip so
 * nested lists do not animate competing FLIPs (Phase 7 perf guardrail).
 */
export function dashboardEditorNestedFlipMs(): number {
  return 0;
}

/** Inline styles applied by svelte-dnd-action to the current drop target while dragging. */
export function dashboardEditorDropTargetStyle(): Record<string, string> {
  return {
    outline: "2px dashed var(--color-primary-500)",
    outlineOffset: "3px",
    borderRadius: "0.375rem",
  };
}
