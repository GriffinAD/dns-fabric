import type { DragDropState } from "@thisux/sveltednd";
import { dndState } from "@thisux/sveltednd";

import type { DashboardDndListItem } from "../grid/groupDndFinalize";
import { applyDashboardInvalidDrop } from "./dashboardSveltedndApply";
import {
  parseDropContainer,
  type DashboardDragPayload,
} from "./dashboardSveltedndTypes";
import { resolveRootTileDropBand } from "./dashboardSveltedndApply";

/** Droppable nodes in {@link DashboardEditRootGrid} expose their sveltednd container id. */
export const DND_CONTAINER_ATTR = "data-dnd-container";

/** Matches {@link DashboardEditRootGrid} `dndDropAttrs.dragOverClass`. */
export const EDITOR_DROP_HOVER_CLASSES = [
  "svelte-dnd-drop-target",
  "outline",
  "outline-2",
  "outline-dashed",
  "outline-offset-[3px]",
  "rounded-md",
  "outline-primary-500",
] as const;

let hoveredDropEl: HTMLElement | null = null;
let lastEditorDragClient: { x: number; y: number } | null = null;

export function getLastEditorDragClient(): { x: number; y: number } | null {
  return lastEditorDragClient;
}

export function clearLastEditorDragClient(): void {
  lastEditorDragClient = null;
}

function syncDropPositionFromPointer(
  container: string,
  dropEl: HTMLElement,
  hit: Element | null,
  clientX: number,
  clientY: number,
): void {
  const slot = parseDropContainer(container);
  if (!slot) return;
  const targetEl = hit instanceof HTMLElement ? hit : dropEl;
  if (slot.kind === "root" || slot.kind === "groupChild") {
    const band = resolveRootTileDropBand(targetEl, "before", { x: clientX, y: clientY });
    dndState.dropPosition = band === "after" ? "after" : "before";
    return;
  }
  if (slot.kind === "rootRowEnd" || slot.kind === "rootGapAfter" || slot.kind === "groupGapAfter") {
    dndState.dropPosition = "after";
    return;
  }
  dndState.dropPosition = "before";
}

function clearHoveredDropClasses(): void {
  if (!hoveredDropEl) return;
  hoveredDropEl.classList.remove(...EDITOR_DROP_HOVER_CLASSES);
  hoveredDropEl = null;
}

/**
 * While dragging, resolve the drop zone under the pointer and mirror sveltednd hover state.
 * HTML5 dragenter can miss when tile chrome sits above droppable hit layers; this keeps
 * `targetContainer`, invalid-drop feedback, and drop-target outlines in sync.
 */
export function syncEditorDragHoverFromPointer(
  clientX: number,
  clientY: number,
  dndRoot: DashboardDndListItem[],
): void {
  if (!dndState.isDragging) {
    clearHoveredDropClasses();
    clearLastEditorDragClient();
    return;
  }

  lastEditorDragClient = { x: clientX, y: clientY };

  const hit = document.elementFromPoint(clientX, clientY);
  const dropEl = hit?.closest(`[${DND_CONTAINER_ATTR}]`);
  const nextHover = dropEl instanceof HTMLElement ? dropEl : null;

  if (nextHover !== hoveredDropEl) {
    clearHoveredDropClasses();
    if (nextHover) {
      nextHover.classList.add(...EDITOR_DROP_HOVER_CLASSES);
      hoveredDropEl = nextHover;
    }
  }

  if (nextHover) {
    const container = nextHover.getAttribute(DND_CONTAINER_ATTR);
    if (container) {
      dndState.targetContainer = container;
      dndState.targetElement = hit instanceof Element ? hit : nextHover;
      syncDropPositionFromPointer(container, nextHover, hit, clientX, clientY);
    }
  } else {
    dndState.targetContainer = null;
    dndState.targetElement = null;
    dndState.dropPosition = null;
  }

  applyDashboardInvalidDrop(dndState as DragDropState<DashboardDragPayload>, dndRoot);
}

export function clearEditorDragHover(): void {
  clearHoveredDropClasses();
  clearLastEditorDragClient();
}
