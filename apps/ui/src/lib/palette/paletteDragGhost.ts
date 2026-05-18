import type { DashboardTile } from "../dashboard/types";
import { tileColSpanForPlugin } from "../plugins/core/pluginGridPolicy";

export const PALETTE_DRAG_IMAGE_ID = "__palette-drag-image__";

export function buildPaletteDragImageTile(pluginId: string): DashboardTile {
  return {
    id: PALETTE_DRAG_IMAGE_ID,
    pluginId,
    hostControl: "single-panel",
    displayMode: "full",
    grid: { col: 0, row: 0, colSpan: tileColSpanForPlugin({ pluginId }), rowSpan: 1 },
  };
}
