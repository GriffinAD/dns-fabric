/**
 * Drag intent taxonomy for dashboard DnD (palette, in-grid moves). Wire Host + interactions
 * layers incrementally; see `UI_PLUGIN_BRANCH_PROGRESS.md` Phase 7.
 */
export type DashboardDragIntent =
  | { kind: "palette-plugin"; pluginId: string }
  | { kind: "palette-core"; coreId: "add-group" }
  | { kind: "grid-tile"; tileId: string }
  | { kind: "grid-group"; groupId: string };

/** Runtime anchor so Vitest coverage includes this module (types alone compile away). */
export const DASHBOARD_DRAG_INTENT_KINDS: DashboardDragIntent["kind"][] = [
  "palette-plugin",
  "palette-core",
  "grid-tile",
  "grid-group",
];
