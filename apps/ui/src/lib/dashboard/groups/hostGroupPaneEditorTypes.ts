import type { DragDropState } from "@thisux/sveltednd";

import type { DashboardDndListItem } from "../grid/groupDndFinalize";
import type { DashboardDragPayload } from "../interactions/dashboardSveltedndTypes";
import type { DashboardGroup, DashboardTile } from "../types";

/** Editor bindings for drop targets inside a tab pane or stack section panel. */
export type HostPaneEditorBindings = {
  dropCb: {
    onDrop: (state: DragDropState<DashboardDragPayload>) => void;
    onDragOver: (state: DragDropState<DashboardDragPayload>) => void;
    onDragEnd: (state: DragDropState<DashboardDragPayload>) => void;
  };
  getSubDndList: (group: DashboardGroup) => DashboardDndListItem[];
  noWrapEditPortW: Record<string, number>;
  noWrapStripPortMeasure: (el: HTMLDivElement, gid: string) => { destroy: () => void };
  chromeDragSm: string;
  chromeEditSm: string;
  editorTileInPlay: (id: string) => boolean;
  editorGroupInPlay: (id: string) => boolean;
  onEditGroup?: (g: DashboardGroup) => void;
  onEditTile?: (tile: DashboardTile) => void;
  onItemColSpanChange?: (
    itemId: string,
    colSpan: number,
    phase: "preview" | "commit",
    groupId?: string,
  ) => void;
  groupInnerSurfaceDragActive: () => boolean;
};
