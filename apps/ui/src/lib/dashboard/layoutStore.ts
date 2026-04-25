import { get, writable } from "svelte/store";

import { DataGateway } from "../dataGateway";
import { normalizeLayoutStrict } from "./layoutNormalize";
import {
  clearLayoutLocalPersistGate,
  initialDashboardLayout,
  isLayoutLocalPersistBlocked,
  getLayoutLocalPersistBlockedReason,
  parseDashboardLayout,
  saveDashboardLayout,
} from "./layoutStorage";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV2,
  DashboardTile,
  RootLayoutItem,
} from "./types";

export type LayoutSource = "server" | "cache";

export type ApplyLayoutOpts = {
  preserveRootPlacementIfComplete?: boolean;
  editModeOverride?: boolean;
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

  const layout = writable<DashboardLayoutV2>(initialDashboardLayout());
  /** Validation failures, reset errors, and other blocking issues (not PUT failures). */
  const loadError = writable<string | null>(null);
  /** Last dashboard layout PUT failure; dashboard may still be usable from cache. */
  const persistError = writable<string | null>(null);
  /** localStorage layout writes disabled (e.g. stored layout version newer than this client). */
  const localPersistBlocked = writable(isLayoutLocalPersistBlocked());
  const localPersistBlockedReason = writable(getLayoutLocalPersistBlockedReason());
  const editorOpen = writable(false);
  const layoutSource = writable<LayoutSource>("cache");

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
      await gateway.putDashboardLayout(dashboardId, current);
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
      const normalized = normalizeLayoutStrict(next, editMode, {
        preserveRootPlacementIfComplete: opts?.preserveRootPlacementIfComplete,
      });
      loadError.set(null);
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

    acceptServerLayout(next: DashboardLayoutV2) {
      releaseLocalPersistGate();
      layout.set(next);
      saveDashboardLayout(next);
      layoutSource.set("server");
      loadError.set(null);
    },

    markLayoutHydratedFromCacheOnly() {
      layoutSource.set("cache");
    },

    applyStructure,

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
        await gateway.postDashboardLayoutSaveFile(dashboardId, current);
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
      applyStructure({ version: 2, items: [...L.items, next] });
    },

    addGroup() {
      const L = get(layout);
      const n = L.items.length;
      const id = `group-${n + 1}-${Date.now()}`;
      const g: DashboardGroup = { kind: "group", id, showBorder: true, children: [] };
      applyStructure({ version: 2, items: [...L.items, g] });
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
      const items = L.items.map((it) => {
        if (it.kind === "group" && it.id === groupId) {
          return { ...it, children: [...it.children, newTile] } satisfies DashboardGroup;
        }
        return it;
      });
      applyStructure({ version: 2, items });
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
        applyStructure(parsed);
      } catch (e: unknown) {
        loadError.set(e instanceof Error ? e.message : String(e));
      }
    },
  };
}
