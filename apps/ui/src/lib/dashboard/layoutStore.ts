import { get, writable } from "svelte/store";

import { DataGateway } from "../dataGateway";
import { defaultPaletteOptionsForPiholeHaPlugin } from "../piholeCp/piholeHaPluginIds";
import { cloneLayoutJson, placementForNewEmptyNestedGroup } from "./gridPlacement";
import { normalizeLayoutStrict } from "./layoutNormalize";
import {
  clearLayoutLocalPersistGate,
  DASHBOARD_LAYOUT_STORAGE_KEY,
  isLayoutLocalPersistBlocked,
  getLayoutLocalPersistBlockedReason,
  parseDashboardLayout,
  saveDashboardLayout,
} from "./layoutStorage";
import {
  appendGroupToGroupInItems,
  appendTileToGroupInItems,
  findGroupByIdInItems,
} from "./layoutTree";
import { ensureLayoutV3, layoutNestedGroupDepthExceeded } from "./migration";
import { initialDashboardLayout, flushLayoutToServer, postLayoutSaveFileSnapshot } from "./persistence";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV3,
  DashboardTile,
  RootLayoutItem,
} from "./types";
import { MAX_DASHBOARD_GROUP_DEPTH } from "./types";

export type LayoutSource = "server" | "cache";

export type ApplyLayoutOpts = {
  preserveRootPlacementIfComplete?: boolean;
  editModeOverride?: boolean;
  /** When true, do not push the pre-change layout onto the undo stack (server reset / hydrate). */
  skipHistory?: boolean;
};

export type CreateLayoutStoreOptions = {
  gateway: DataGateway;
  /** @default "default" */
  dashboardId?: string;
  /** @default `DASHBOARD_LAYOUT_STORAGE_KEY` (Kea Fabric dashboard cache). */
  layoutStorageKey?: string;
  /** When set, seed the store instead of `initialDashboardLayout()` (which reads the default storage key). */
  initialLayout?: DashboardLayout;
  /** When true, layout edits persist to localStorage only; no debounced PUT / save-file / reset to Kea APIs. */
  skipServerLayoutPersist?: boolean;
};

export type LayoutStore = ReturnType<typeof createLayoutStore>;

/**
 * Dashboard layout state, local persistence, and debounced server sync (400 ms).
 * See `docs/planning/UI_ENGINE_SPEC.md` §3.2 and `docs/planning/UI_ENGINE_PLAN.md` Phase 3.
 */
export function createLayoutStore(options: CreateLayoutStoreOptions) {
  const gateway = options.gateway;
  const dashboardId = options.dashboardId ?? "default";
  const layoutStorageKey = options.layoutStorageKey ?? DASHBOARD_LAYOUT_STORAGE_KEY;
  const skipServerLayoutPersist = options.skipServerLayoutPersist === true;
  const initialLayoutV3 =
    options.initialLayout != null ? ensureLayoutV3(options.initialLayout) : initialDashboardLayout();

  const layout = writable<DashboardLayoutV3>(initialLayoutV3);
  /** Validation failures, reset errors, and other blocking issues (not PUT failures). */
  const loadError = writable<string | null>(null);
  /** Last dashboard layout PUT failure; dashboard may still be usable from cache. */
  const persistError = writable<string | null>(null);
  /** localStorage layout writes disabled (e.g. stored layout version newer than this client). */
  const localPersistBlocked = writable(isLayoutLocalPersistBlocked());
  const localPersistBlockedReason = writable(getLayoutLocalPersistBlockedReason());
  const editorOpen = writable(false);
  const layoutSource = writable<LayoutSource>("cache");

  const UNDO_CAP = 50;
  let undoPast: DashboardLayoutV3[] = [];
  let undoFuture: DashboardLayoutV3[] = [];

  function clearUndoStacks() {
    undoPast = [];
    undoFuture = [];
  }

  function releaseLocalPersistGate() {
    clearLayoutLocalPersistGate();
    localPersistBlocked.set(false);
    localPersistBlockedReason.set(null);
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function clearDebounce() {
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  async function flushPersist(): Promise<void> {
    clearDebounce();
    if (skipServerLayoutPersist) {
      persistError.set(null);
      return;
    }
    const current = get(layout);
    try {
      await flushLayoutToServer(gateway, dashboardId, current);
      persistError.set(null);
    } catch (e: unknown) {
      persistError.set(e instanceof Error ? e.message : String(e));
    }
  }

  function schedulePersist() {
    if (skipServerLayoutPersist) return;
    clearDebounce();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void flushPersist();
    }, 400);
  }

  function applyStructure(next: DashboardLayout, opts?: ApplyLayoutOpts) {
    try {
      const editMode = opts?.editModeOverride !== undefined ? opts.editModeOverride : get(editorOpen);
      const skipHistory = opts?.skipHistory === true;
      const snapshotBefore = cloneLayoutJson(get(layout));
      const normalized = normalizeLayoutStrict(next, editMode, {
        preserveRootPlacementIfComplete: opts?.preserveRootPlacementIfComplete,
      });
      loadError.set(null);
      if (editMode && !skipHistory) {
        undoPast.push(snapshotBefore);
        if (undoPast.length > UNDO_CAP) undoPast.shift();
        undoFuture = [];
      }
      layout.set(normalized);
      saveDashboardLayout(normalized, layoutStorageKey);
      schedulePersist();
    } catch (e: unknown) {
      loadError.set(e instanceof Error ? e.message : String(e));
    }
  }

  return {
    layout,
    loadError,
    persistError,
    localPersistBlocked,
    localPersistBlockedReason,
    editorOpen,
    layoutSource,

    acceptServerLayout(next: DashboardLayout) {
      releaseLocalPersistGate();
      clearUndoStacks();
      const v3 = ensureLayoutV3(next);
      layout.set(v3);
      saveDashboardLayout(v3, layoutStorageKey);
      layoutSource.set("server");
      loadError.set(null);
    },

    markLayoutHydratedFromCacheOnly() {
      layoutSource.set("cache");
    },

    applyStructure,

    canUndo() {
      return undoPast.length > 0;
    },

    canRedo() {
      return undoFuture.length > 0;
    },

    undo() {
      if (undoPast.length === 0) return;
      const cur = cloneLayoutJson(get(layout));
      const prev = undoPast.pop()!;
      undoFuture.unshift(cur);
      layout.set(prev);
      saveDashboardLayout(prev, layoutStorageKey);
      schedulePersist();
    },

    redo() {
      if (undoFuture.length === 0) return;
      const cur = cloneLayoutJson(get(layout));
      const nxt = undoFuture.shift()!;
      undoPast.push(cur);
      layout.set(nxt);
      saveDashboardLayout(nxt, layoutStorageKey);
      schedulePersist();
    },

    openEditor() {
      editorOpen.set(true);
    },

    /** Call after layout commit while editor was still “open” (e.g. overlay exit path). */
    async closeEditorAndFlush() {
      editorOpen.set(false);
      await flushPersist();
    },

    async flush() {
      await flushPersist();
    },

    /** Persist layout on the server (live store + timestamped snapshot under ``dashboard-layout-exports/``) and local cache. */
    async saveLayoutToFile() {
      clearDebounce();
      loadError.set(null);
      const current = get(layout);
      if (skipServerLayoutPersist) {
        persistError.set(null);
        saveDashboardLayout(current, layoutStorageKey);
        return;
      }
      try {
        await postLayoutSaveFileSnapshot(gateway, dashboardId, current);
        persistError.set(null);
        saveDashboardLayout(current, layoutStorageKey);
      } catch (e: unknown) {
        persistError.set(e instanceof Error ? e.message : String(e));
      }
    },

    addRootTile(pluginId: string, insertBeforeIndex?: number) {
      const L = get(layout);
      const n = L.items.length;
      const id = `tile-${n + 1}-${Date.now()}`;
      const piholeOpts = defaultPaletteOptionsForPiholeHaPlugin(pluginId);
      const next: RootLayoutItem = {
        kind: "tile",
        id,
        pluginId,
        hostControl: "single-panel",
        displayMode: "full",
        ...(piholeOpts ? { options: piholeOpts } : {}),
      };
      const items = [...L.items];
      const at =
        insertBeforeIndex === undefined || insertBeforeIndex < 0 || insertBeforeIndex > items.length
          ? items.length
          : insertBeforeIndex;
      items.splice(at, 0, next);
      applyStructure({ version: 3, items });
    },

    addGroup(insertBeforeIndex?: number) {
      const L = get(layout);
      const n = L.items.length;
      const id = `group-${n + 1}-${Date.now()}`;
      const g: DashboardGroup = { kind: "group", id, showBorder: true, children: [] };
      const items = [...L.items];
      const at =
        insertBeforeIndex === undefined || insertBeforeIndex < 0 || insertBeforeIndex > items.length
          ? items.length
          : insertBeforeIndex;
      items.splice(at, 0, g);
      applyStructure({ version: 3, items });
    },

    addGroupToParent(parentGroupId: string) {
      const L = get(layout);
      const parent = findGroupByIdInItems(L.items, parentGroupId);
      if (!parent) {
        loadError.set("Container not found.");
        return;
      }
      if (parent.innerWrap === true) {
        loadError.set(
          "Nested containers are not allowed when Auto wrap is on for the parent. Turn off Auto wrap in container settings, then try again.",
        );
        return;
      }
      const m = L.items.length;
      const id = `group-${m + 1}-${Date.now()}`;
      const grid = placementForNewEmptyNestedGroup(parent);
      const g: DashboardGroup = { kind: "group", id, showBorder: true, children: [], grid };
      const nextItems = appendGroupToGroupInItems(L.items, parentGroupId, g);
      if (layoutNestedGroupDepthExceeded(nextItems)) {
        loadError.set(`Nested containers cannot exceed depth ${MAX_DASHBOARD_GROUP_DEPTH}.`);
        return;
      }
      applyStructure({ version: 3, items: nextItems });
    },

    addTileToGroup(groupId: string, pluginId: string) {
      const L = get(layout);
      const tId = `tile-in-${groupId}-${Date.now()}`;
      const piholeOpts = defaultPaletteOptionsForPiholeHaPlugin(pluginId);
      const newTile: DashboardTile = {
        id: tId,
        pluginId,
        hostControl: "single-panel",
        displayMode: "full",
        ...(piholeOpts ? { options: piholeOpts } : {}),
      };
      applyStructure({
        version: 3,
        items: appendTileToGroupInItems(L.items, groupId, newTile),
      });
    },

    async resetToBaseline() {
      loadError.set(null);
      persistError.set(null);
      if (skipServerLayoutPersist) {
        loadError.set("Reset to server baseline is not available in this workspace.");
        return;
      }
      try {
        const raw = await gateway.resetDashboardLayout(dashboardId);
        const parsed = parseDashboardLayout(raw);
        if (!parsed) {
          loadError.set("Reset returned an invalid layout.");
          return;
        }
        releaseLocalPersistGate();
        applyStructure(parsed, { skipHistory: true });
      } catch (e: unknown) {
        loadError.set(e instanceof Error ? e.message : String(e));
      }
    },
  };
}
