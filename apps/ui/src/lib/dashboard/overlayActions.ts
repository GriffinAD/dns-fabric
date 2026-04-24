import { commitGroupInnerRowWraps, reorderRootLayoutItemsPreservingSlotOrigins } from "./gridPlacement";
import {
  findTileInLayout,
  mapRootItemsReplaceGroup,
  mapTileInLayout,
  moveTileToParent,
  PARENT_ID_DASHBOARD,
} from "./layoutTree";
import type { DashboardGroup, DashboardLayout, DashboardLayoutV2, DashboardTile } from "./types";

export type OverlayActionsDeps = {
  getLayout: () => DashboardLayoutV2;
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
      deps.setSettingsTile(null);
    },
    openGroupSettings(g: DashboardGroup) {
      deps.setSettingsTile(null);
      deps.setSettingsGroup(g);
    },
    closeGroupSettings() {
      deps.setSettingsGroup(null);
    },
    saveGroupFromOverlay(next: DashboardGroup) {
      const layout = deps.getLayout();
      const replaced = mapRootItemsReplaceGroup(layout.items, next.id, next);
      const reordered = reorderRootLayoutItemsPreservingSlotOrigins(layout.items, replaced);
      const withCommit = commitGroupInnerRowWraps(reordered);
      deps.applyLayoutStructure({ version: 2, items: withCommit }, { preserveRootPlacementIfComplete: true });
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
            version: 2,
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
          { version: 2, items },
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
        { version: 2, items: next },
        { preserveRootPlacementIfComplete: true },
      );
    },
    deleteGroupChildTile(groupId: string, tileId: string) {
      const layout = deps.getLayout();
      const next = layout.items.map((it) =>
        it.kind === "group" && it.id === groupId
          ? { ...it, children: it.children.filter((c) => c.id !== tileId) }
          : it,
      );
      if (deps.getSettingsTile() && !findTileInLayout(next, deps.getSettingsTile()!.id)) {
        deps.setSettingsTile(null);
      }
      deps.applyLayoutStructure(
        { version: 2, items: next },
        { preserveRootPlacementIfComplete: true },
      );
    },
    selectDashboardView() {
      if (deps.getEditorOpen()) {
        const layout = deps.getLayout();
        const committed = commitGroupInnerRowWraps(layout.items);
        deps.applyLayoutStructure(
          { version: 2, items: committed },
          { preserveRootPlacementIfComplete: true, editModeOverride: false },
        );
      }
    },
  };
}

export type OverlayActions = ReturnType<typeof createOverlayActions>;
