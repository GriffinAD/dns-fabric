import { commitGroupInnerRowWraps, reorderRootLayoutItemsPreservingSlotOrigins } from "../grid/gridPlacement";
import {
  findTileInLayout,
  mapLayoutReplaceGroupById,
  mapTileInLayout,
  moveTileToParent,
  PARENT_ID_DASHBOARD,
  removeLayoutGroupById,
  removeTileFromAnywhere,
} from "./layoutTree";
import { editorSelection } from "../editor/editorState";
import type { DashboardGroup, DashboardLayout, DashboardLayoutV3, DashboardTile } from "../types";

export type OverlayActionsDeps = {
  getLayout: () => DashboardLayoutV3;
  getEditorOpen: () => boolean;
  getSettingsTile: () => DashboardTile | null;
  getSettingsGroup: () => DashboardGroup | null;
  setSettingsTile: (t: DashboardTile | null) => void;
  setSettingsGroup: (g: DashboardGroup | null) => void;
  applyLayoutStructure: (
    next: DashboardLayout,
    opts?: { preserveRootPlacementIfComplete?: boolean; editModeOverride?: boolean },
  ) => void;
};

export function createOverlayActions(deps: OverlayActionsDeps) {
  return {
    openTileSettings(tile: DashboardTile) {
      deps.setSettingsGroup(null);
      deps.setSettingsTile(tile);
    },
    closeTileSettings() {
      editorSelection.set(null);
      deps.setSettingsTile(null);
    },
    openGroupSettings(g: DashboardGroup) {
      deps.setSettingsTile(null);
      deps.setSettingsGroup(g);
    },
    closeGroupSettings() {
      editorSelection.set(null);
      deps.setSettingsGroup(null);
    },
    saveGroupFromOverlay(next: DashboardGroup) {
      const layout = deps.getLayout();
      const replaced = mapLayoutReplaceGroupById(layout.items, next.id, next);
      const reordered = reorderRootLayoutItemsPreservingSlotOrigins(layout.items, replaced);
      const withCommit = commitGroupInnerRowWraps(reordered);
      deps.applyLayoutStructure({ version: 3, items: withCommit }, { preserveRootPlacementIfComplete: true });
      deps.setSettingsGroup(null);
    },
    saveTileFromOverlay(updated: DashboardTile, parentId: string) {
      const layout = deps.getLayout();
      const cleaned: DashboardTile = { ...updated };
      delete (cleaned as { rowPanel?: string }).rowPanel;
      const found = findTileInLayout(layout.items, updated.id);
      const prevGroup = found?.inGroup?.id ?? null;
      const nextGroup = parentId === PARENT_ID_DASHBOARD ? null : parentId;
      if (prevGroup === nextGroup) {
        deps.applyLayoutStructure(
          {
            version: 3,
            items: mapTileInLayout(layout.items, updated.id, (prev) => ({ ...prev, ...cleaned })),
          },
          { preserveRootPlacementIfComplete: true },
        );
      } else {
        const items = moveTileToParent(
          layout.items,
          updated.id,
          nextGroup === null ? { type: "root" } : { type: "group", groupId: nextGroup },
          cleaned,
        );
        deps.applyLayoutStructure(
          { version: 3, items },
          { preserveRootPlacementIfComplete: true },
        );
      }
      deps.setSettingsTile(null);
    },
    deleteRootLayoutItem(id: string) {
      const layout = deps.getLayout();
      const next = layout.items.filter((it) => it.id !== id);
      if (deps.getSettingsGroup()?.id === id) {
        deps.setSettingsGroup(null);
      }
      if (deps.getSettingsTile() && !findTileInLayout(next, deps.getSettingsTile()!.id)) {
        deps.setSettingsTile(null);
      }
      deps.applyLayoutStructure(
        { version: 3, items: next },
        { preserveRootPlacementIfComplete: true },
      );
    },
    deleteGroupChildTile(_groupId: string, tileId: string) {
      const layout = deps.getLayout();
      const next = removeTileFromAnywhere(layout.items, tileId);
      if (deps.getSettingsTile() && !findTileInLayout(next, deps.getSettingsTile()!.id)) {
        deps.setSettingsTile(null);
      }
      deps.applyLayoutStructure(
        { version: 3, items: next },
        { preserveRootPlacementIfComplete: true },
      );
    },
    deleteLayoutGroupById(groupId: string) {
      const layout = deps.getLayout();
      const next = removeLayoutGroupById(layout.items, groupId);
      if (deps.getSettingsGroup()?.id === groupId) {
        deps.setSettingsGroup(null);
      }
      if (deps.getSettingsTile() && !findTileInLayout(next, deps.getSettingsTile()!.id)) {
        deps.setSettingsTile(null);
      }
      deps.applyLayoutStructure(
        { version: 3, items: next },
        { preserveRootPlacementIfComplete: true },
      );
    },
    selectDashboardView() {
      if (deps.getEditorOpen()) {
        const layout = deps.getLayout();
        const committed = commitGroupInnerRowWraps(layout.items);
        deps.applyLayoutStructure(
          { version: 3, items: committed },
          { preserveRootPlacementIfComplete: true, editModeOverride: false },
        );
      }
    },
  };
}

export type OverlayActions = ReturnType<typeof createOverlayActions>;
