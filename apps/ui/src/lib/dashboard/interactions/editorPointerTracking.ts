import { clearEditorDragHover, DND_CONTAINER_ATTR, syncEditorDragHoverFromPointer } from "./dashboardEditorDragHover";
import type { DashboardDndListItem } from "../grid/groupDndFinalize";

export type EditorPointerTrackingHandlers = {
  onPointer: (pt: { x: number; y: number }) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragEnd?: () => void;
};

export type EditorPointerTrackingOptions = {
  getDndRoot: () => DashboardDndListItem[];
};

export function attachEditorPointerTracking(
  active: boolean,
  handlers: EditorPointerTrackingHandlers,
  opts?: EditorPointerTrackingOptions,
): () => void {
  if (!active) return () => {};

  const onMove = (e: PointerEvent) => {
    handlers.onPointer({ x: e.clientX, y: e.clientY });
    if (opts?.getDndRoot) {
      syncEditorDragHoverFromPointer(e.clientX, e.clientY, opts.getDndRoot());
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    handlers.onPointer({ x: e.clientX, y: e.clientY });
    if (opts?.getDndRoot) {
      syncEditorDragHoverFromPointer(e.clientX, e.clientY, opts.getDndRoot());
    }
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const overGrid = hit?.closest('[data-dashboard-editor="grid-chrome"]') != null;
    const overDropTarget = hit?.closest(`[${DND_CONTAINER_ATTR}]`) != null;
    // HTML5 drop requires preventDefault on dragover — including nested container/tab panes.
    if (overGrid || overDropTarget) e.preventDefault();
    handlers.onDragOver?.(e);
  };

  const onDragEnd = () => {
    clearEditorDragHover();
    handlers.onDragEnd?.();
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("dragover", onDragOver);
  document.addEventListener("dragend", onDragEnd, true);

  return () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("dragover", onDragOver);
    document.removeEventListener("dragend", onDragEnd, true);
    clearEditorDragHover();
  };
}
