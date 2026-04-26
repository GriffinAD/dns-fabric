import { get, writable } from "svelte/store";

import { DataGateway } from "../dataGateway";
import { cloneLayoutJson } from "./gridPlacement";
import { normalizeLayoutStrict } from "./layoutNormalize";
import {
  clearLayoutLocalPersistGate,
  isLayoutLocalPersistBlocked,
  getLayoutLocalPersistBlockedReason,
  parseDashboardLayout,
  saveDashboardLayout,
} from "./layoutStorage";
import { appendTileToGroupInItems } from "./layoutTree";
import { ensureLayoutV3 } from "./migration";
import { initialDashboardLayout, flushLayoutToServer, postLayoutSaveFileSnapshot } from "./persistence";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV3,
  DashboardTile,
  RootLayoutItem,
} from "./types";

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
};

export type LayoutStore = ReturnType<typeof createLayoutStore>;

/**
 * Dashboard layout state, local persistence, and debounced server sync (400 ms).
 * See `docs/planning/UI_ENGINE_SPEC.md` §3.2 and `docs/planning/UI_ENGINE_PLAN.md` Phase 3.
 */
export function createLayoutStore(options: CreateLayoutStoreOptions) {
  const gateway = options.gateway;
  const dashboardId = options.dashboardId ?? "default";

  const layout = writable<DashboardLayoutV3>(initialDashboardLayout());
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
    const current = get(layout);
    try {
      await flushLayoutToServer(gateway, dashboardId, current);
      persistError.set(null);
    } catch (e: unknown) {
      persistError.set(e instanceof Error ? e.message : String(e));
    }
  }

  function schedulePersist() {
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
      saveDashboardLayout(normalized);
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
      saveDashboardLayout(v3);
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
      saveDashboardLayout(prev);
      schedulePersist();
    },

    redo() {
      if (undoFuture.length === 0) return;
      const cur = cloneLayoutJson(get(layout));
      const nxt = undoFuture.shift()!;
      undoPast.push(cur);
      layout.set(nxt);
      saveDashboardLayout(nxt);
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
      try {
        await postLayoutSaveFileSnapshot(gateway, dashboardId, current);
        persistError.set(null);
        saveDashboardLayout(current);
      } catch (e: unknown) {
        persistError.set(e instanceof Error ? e.message : String(e));
      }
    },

    addRootTile(pluginId: string) {
      const L = get(layout);
      const n = L.items.length;
      const id = `tile-${n + 1}-${Date.now()}`;
      const next: RootLayoutItem = {
        kind: "tile",
        id,
        pluginId,
        hostControl: "single-panel",
        displayMode: "full",
      };
      applyStructure({ version: 3, items: [...L.items, next] });
    },

    addGroup() {
      const L = get(layout);
      const n = L.items.length;
      const id = `group-${n + 1}-${Date.now()}`;
      const g: DashboardGroup = { kind: "group", id, showBorder: true, children: [] };
      applyStructure({ version: 3, items: [...L.items, g] });
    },

    addTileToGroup(groupId: string, pluginId: string) {
      const L = get(layout);
      const tId = `tile-in-${groupId}-${Date.now()}`;
      const newTile: DashboardTile = {
        id: tId,
        pluginId,
        hostControl: "single-panel",
        displayMode: "full",
      };
      applyStructure({
        version: 3,
        items: appendTileToGroupInItems(L.items, groupId, newTile),
      });
    },

    async resetToBaseline() {
      loadError.set(null);
      persistError.set(null);
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
