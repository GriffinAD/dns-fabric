/**
 * Visual / timing feedback for dashboard layout editor DnD (svelte-dnd-action).
 * Placement semantics stay in `groupDndFinalize` / `layoutStore`; this module is presentation only.
 */

import type { DashboardDndListItem } from "../groupDndFinalize";
import { isDndCellGroup } from "../groupDndFinalize";

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

export type DashboardDragLiftOptions = {
  /**
   * Root/nested **containers** span many grid columns; a slightly more transparent ghost
   * keeps the dashed in-list slot readable under the floating clone.
   */
  preferSlotVisibility?: boolean;
};

/**
 * Visual “lift” on the floating drag clone (`#dnd-action-dragged-el`).
 * Do **not** set `transform` here — the library uses it for pointer tracking / drop animation.
 */
export function applyDashboardDragLift(
  element: HTMLElement | undefined,
  reducedMotion: boolean,
  options?: DashboardDragLiftOptions,
): void {
  if (!element) return;
  const slot = Boolean(options?.preferSlotVisibility);
  if (reducedMotion) {
    element.style.opacity = slot ? "0.96" : "0.98";
    element.style.boxShadow = "";
    return;
  }
  element.style.opacity = slot ? "0.86" : "0.94";
  element.style.boxShadow = "0 14px 44px rgba(15, 23, 42, 0.22)";
  element.style.borderRadius = "0.375rem";
}

/** True when the dragged list row is a dashboard **container** (group). */
export function preferSlotVisibilityForDndListItem(data: unknown): boolean {
  if (data == null || typeof data !== "object" || !("item" in data)) return false;
  return isDndCellGroup((data as DashboardDndListItem).item);
}

/**
 * Callback for `transformDraggedElement` on dashboard `dragHandleZone`s (bound to reduce-motion).
 */
export function createDashboardEditorTransformDragged(reducedMotion: boolean) {
  return (element?: HTMLElement, data?: unknown, _index?: number) => {
    applyDashboardDragLift(element, reducedMotion, {
      preferSlotVisibility: preferSlotVisibilityForDndListItem(data),
    });
  };
}
