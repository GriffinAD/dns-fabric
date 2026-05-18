import type { DragDropState } from "@thisux/sveltednd";

import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
import { parseDragPayload } from "../interactions/dashboardSveltedndTypes";

export type LayoutDropCallbacks = {
  onDrop: (state: DragDropState<DashboardDragPayload>) => void;
  onDragOver: (state: DragDropState<DashboardDragPayload>) => void;
  onDragEnd: (state: DragDropState<DashboardDragPayload>) => void;
};

export function isPaletteDragPayload(drag: DashboardDragPayload | null): boolean {
  return drag?.k === "pp" || drag?.k === "pg" || drag?.k === "pgt" || drag?.k === "pgs";
}

/** Palette drops delegate to the editor grid; local handler runs tab/stack reorder. */
export function createHostGroupStripDropCallbacks(
  layoutDropCb: LayoutDropCallbacks | undefined,
  onLocalDrop?: (state: DragDropState<DashboardDragPayload>) => void,
): LayoutDropCallbacks {
  return {
    onDrop: (state: DragDropState<DashboardDragPayload>) => {
      const drag = parseDragPayload(state.draggedItem);
      if (isPaletteDragPayload(drag)) {
        layoutDropCb?.onDrop(state);
        return;
      }
      onLocalDrop?.(state);
    },
    onDragOver: (state: DragDropState<DashboardDragPayload>) => {
      const drag = parseDragPayload(state.draggedItem);
      if (isPaletteDragPayload(drag)) {
        state.invalidDrop = false;
        layoutDropCb?.onDragOver(state);
        return;
      }
      state.invalidDrop = false;
    },
    onDragEnd: (state: DragDropState<DashboardDragPayload>) => {
      layoutDropCb?.onDragEnd(state);
    },
  };
}
