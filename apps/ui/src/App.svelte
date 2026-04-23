<script lang="ts">
  import { onMount } from "svelte";
  import Button from "flowbite-svelte/Button.svelte";
  import House from "lucide-svelte/icons/house";
  import Settings from "lucide-svelte/icons/settings";

  import AdminPage from "./lib/admin/AdminPage.svelte";
  import type { PluginEntry } from "./lib/api/types";
  import { DataGateway } from "./lib/dataGateway";
  import DashboardHost from "./lib/dashboard/DashboardHost.svelte";
  import {
    clampGridColSpan,
    clampGridRowSpan,
    commitGroupInnerRowWraps,
    groupOuterColSpan,
    layoutWithGrid,
    reorderRootLayoutItemsPreservingSlotOrigins,
    tileColSpan,
  } from "./lib/dashboard/gridPlacement";
  import {
    initialDashboardLayout,
    parseDashboardLayout,
    saveDashboardLayout,
  } from "./lib/dashboard/layoutStorage";
  import {
    findTileInLayout,
    mapRootItemsReplaceGroup,
    mapTileInLayout,
    moveTileToParent,
    PARENT_ID_DASHBOARD,
  } from "./lib/dashboard/layoutTree";
  import GroupSettingsOverlay from "./lib/dashboard/GroupSettingsOverlay.svelte";
  import TileSettingsOverlay from "./lib/dashboard/TileSettingsOverlay.svelte";
  import type { DashboardGroup, DashboardLayout, DashboardLayoutV2, DashboardTile, RootLayoutItem } from "./lib/dashboard/types";
  import { isLayoutV2 } from "./lib/dashboard/types";
  import { UI_VERSION } from "./lib/uiVersion";
  import DashboardControls from "./lib/dashboard/DashboardControls.svelte";
  import ThemeControls from "./lib/theme/ThemeControls.svelte";
  import { loadThemePreferences, resyncDocumentThemeFromStorage } from "./lib/theme/themeStorage";

  let plugins = $state<PluginEntry[]>([]);
  let layout = $state<DashboardLayoutV2>(initialDashboardLayout());
  let editorOpen = $state(false);
  let loadError = $state<string | null>(null);
  let liveCpuPercent = $state<number | null>(null);
  let route = $state<"home" | "admin">("home");
  let settingsTile = $state<DashboardTile | null>(null);
  let settingsGroup = $state<DashboardGroup | null>(null);

  const gateway = new DataGateway();

  function syncRouteFromHash() {
    route = window.location.hash === "#/admin" ? "admin" : "home";
  }

  function goHome() {
    window.location.hash = "";
    route = "home";
  }

  function goAdmin() {
    window.location.hash = "#/admin";
    route = "admin";
  }

  function openTileSettings(tile: DashboardTile) {
    settingsGroup = null;
    settingsTile = tile;
  }

  function closeTileSettings() {
    settingsTile = null;
  }

  function openGroupSettings(g: DashboardGroup) {
    settingsTile = null;
    settingsGroup = g;
  }

  function closeGroupSettings() {
    settingsGroup = null;
  }

  function saveGroupFromOverlay(next: DashboardGroup) {
    const replaced = mapRootItemsReplaceGroup(layout.items, next.id, next);
    const reordered = reorderRootLayoutItemsPreservingSlotOrigins(layout.items, replaced);
    const withCommit = commitGroupInnerRowWraps(reordered);
    applyLayoutStructure({ version: 2, items: withCommit }, { preserveRootPlacementIfComplete: true });
    closeGroupSettings();
  }

  function saveTileFromOverlay(updated: DashboardTile, parentId: string) {
    const cleaned: DashboardTile = { ...updated };
    delete (cleaned as { rowPanel?: string }).rowPanel;
    const found = findTileInLayout(layout.items, updated.id);
    const prevGroup = found?.inGroup?.id ?? null;
    const nextGroup = parentId === PARENT_ID_DASHBOARD ? null : parentId;
    if (prevGroup === nextGroup) {
      applyLayoutStructure({
        version: 2,
        items: mapTileInLayout(layout.items, updated.id, () => cleaned),
      });
    } else {
      const items = moveTileToParent(
        layout.items,
        updated.id,
        nextGroup === null ? { type: "root" } : { type: "group", groupId: nextGroup },
        cleaned,
      );
      applyLayoutStructure({ version: 2, items });
    }
    closeTileSettings();
  }

  const settingsParentId = $derived.by(() => {
    if (!settingsTile) return PARENT_ID_DASHBOARD;
    const f = findTileInLayout(layout.items, settingsTile.id);
    return f?.inGroup ? f.inGroup.id : PARENT_ID_DASHBOARD;
  });

  const settingsTileContainerG = $derived.by(() => {
    if (!settingsTile) return null;
    const f = findTileInLayout(layout.items, settingsTile.id);
    return f?.inGroup != null ? groupOuterColSpan(f.inGroup) : null;
  });

  const parentOptions = $derived([
    { value: PARENT_ID_DASHBOARD, label: "Dashboard (root)" },
    ...layout.items
      .filter((it): it is DashboardGroup => it.kind === "group")
      .map((g) => ({ value: g.id, label: `Container: ${g.id}` })),
  ]);

  const tileSettingsContainerMeta = $derived(
    layout.items
      .filter((it): it is DashboardGroup => it.kind === "group")
      .map((g) => ({ id: g.id, innerWrap: g.innerWrap === true })),
  );

  function deleteRootLayoutItem(id: string) {
    const next = layout.items.filter((it) => it.id !== id);
    if (settingsGroup?.id === id) {
      closeGroupSettings();
    }
    if (settingsTile && !findTileInLayout(next, settingsTile.id)) {
      closeTileSettings();
    }
    applyLayoutStructure({ version: 2, items: next });
  }

  function deleteGroupChildTile(groupId: string, tileId: string) {
    const next = layout.items.map((it) =>
      it.kind === "group" && it.id === groupId
        ? { ...it, children: it.children.filter((c) => c.id !== tileId) }
        : it,
    );
    if (settingsTile && !findTileInLayout(next, settingsTile.id)) {
      closeTileSettings();
    }
    applyLayoutStructure({ version: 2, items: next });
  }

  function selectDashboardView() {
    if (editorOpen) {
      const committed = commitGroupInnerRowWraps(layout.items);
      applyLayoutStructure(
        { version: 2, items: committed },
        { preserveRootPlacementIfComplete: true, editModeOverride: false },
      );
    }
    editorOpen = false;
  }

  onMount(() => {
    syncRouteFromHash();
    window.addEventListener("hashchange", syncRouteFromHash);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onColorScheme = () => {
      if (loadThemePreferences().mode === "system") {
        resyncDocumentThemeFromStorage();
      }
    };
    mq.addEventListener("change", onColorScheme);

    void gateway
      .listPlugins()
      .then((r) => {
        plugins = r.items;
      })
      .catch((e: unknown) => {
        loadError = e instanceof Error ? e.message : String(e);
      });

    void gateway
      .getDashboardLayout("default")
      .then((raw) => {
        const parsed = parseDashboardLayout(raw);
        if (!parsed) return;
        const withGrid = layoutWithGrid(parsed);
        if (!isLayoutV2(withGrid)) return;
        layout = withGrid;
        saveDashboardLayout(layout);
      })
      .catch(() => {
        /* In-memory mock 404, or no API: keep initialDashboardLayout() from localStorage. */
      });

    const unsub = gateway.subscribeFabricEvents(
      (ev) => {
        if (ev.topic === "fabric.perf.updated") {
          const v = ev.payload.cpu_percent_total;
          if (typeof v === "number" && Number.isFinite(v)) {
            liveCpuPercent = v;
          }
        }
      },
      () => {},
    );

    return () => {
      window.removeEventListener("hashchange", syncRouteFromHash);
      mq.removeEventListener("change", onColorScheme);
      unsub();
    };
  });

  function addTile(pluginId: string) {
    const n = layout.items.length;
    const id = `tile-${n + 1}-${Date.now()}`;
    const next: RootLayoutItem = {
      kind: "tile",
      id,
      pluginId,
      hostControl: "single-panel",
      displayMode: "full",
    };
    applyLayoutStructure({ version: 2, items: [...layout.items, next] });
  }

  function addGroup() {
    const n = layout.items.length;
    const id = `group-${n + 1}-${Date.now()}`;
    const next: DashboardGroup = { kind: "group", id, showBorder: true, children: [] };
    applyLayoutStructure({ version: 2, items: [...layout.items, next] });
  }

  function addTileToGroup(groupId: string, pluginId: string) {
    const tId = `tile-in-${groupId}-${Date.now()}`;
    const newTile: DashboardTile = {
      id: tId,
      pluginId,
      hostControl: "single-panel",
      displayMode: "full",
    };
    const items = layout.items.map((it) => {
      if (it.kind === "group" && it.id === groupId) {
        return { ...it, children: [...it.children, newTile] } satisfies DashboardGroup;
      }
      return it;
    });
    applyLayoutStructure({ version: 2, items });
  }

  function applyLayoutStructure(
    next: DashboardLayout,
    opts?: { preserveRootPlacementIfComplete?: boolean; editModeOverride?: boolean },
  ) {
    try {
      const editMode = opts?.editModeOverride !== undefined ? opts.editModeOverride : editorOpen;
      const normalized = layoutWithGrid(next, {
        preserveRootPlacementIfComplete: opts?.preserveRootPlacementIfComplete,
        editMode,
      });
      if (!isLayoutV2(normalized)) {
        loadError = "Layout update was ignored (invalid structure).";
        return;
      }
      loadError = null;
      layout = normalized;
      saveDashboardLayout(normalized);
      void gateway.putDashboardLayout("default", normalized).catch(() => {});
    } catch (e: unknown) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  async function resetLayoutToBaseline() {
    loadError = null;
    try {
      const raw = await gateway.resetDashboardLayout("default");
      const parsed = parseDashboardLayout(raw);
      if (!parsed) {
        loadError = "Reset returned an invalid layout.";
        return;
      }
      applyLayoutStructure(parsed);
    } catch (e: unknown) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  function onPerfTileGridHint(tileId: string, hint: { colSpan: number; rowSpan: number }) {
    const wantCs = clampGridColSpan(hint.colSpan);
    const wantRs = clampGridRowSpan(hint.rowSpan);
    const found = findTileInLayout(layout.items, tileId);
    if (!found) return;
    const t = found.tile;
    const prevCs = t.grid?.colSpan ?? tileColSpan(t);
    const prevRs = t.grid?.rowSpan ?? 1;
    const nextCs =
      t.pluginId === "perf.ram"
        ? clampGridColSpan(Math.max(prevCs, wantCs))
        : wantCs === 1
          ? 1
          : clampGridColSpan(Math.max(prevCs, wantCs));
    const nextRs = clampGridRowSpan(Math.max(prevRs, wantRs));
    if (prevCs === nextCs && prevRs === nextRs) return;
    const g = t.grid;
    applyLayoutStructure({
      version: 2,
      items: mapTileInLayout(layout.items, tileId, (x) => ({
        ...x,
        grid: {
          col: g?.col ?? 0,
          row: g?.row ?? 0,
          colSpan: nextCs,
          rowSpan: nextRs,
        },
      })),
    });
  }
</script>

<main class="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
  <div class="mx-auto flex max-w-6xl flex-col gap-6">
    <header class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
          <House class="h-8 w-8 shrink-0" aria-hidden="true" />
          Kea Fabric
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Operator shell ({UI_VERSION}). Flowbite Svelte v2 + mocked <code class="font-mono text-sm">/api/v1</code>.
        </p>
      </div>
      <div class="flex w-full min-w-0 flex-col items-stretch gap-4 sm:max-w-md lg:w-auto lg:max-w-none lg:flex-1 lg:flex-row lg:items-end lg:justify-end">
        <ThemeControls />
        <DashboardControls />
      </div>
    </header>

    <div class="flex flex-wrap gap-2">
      <Button type="button" color="alternative" class="inline-flex items-center gap-2" onclick={goHome}>
        <House class="h-4 w-4" aria-hidden="true" />
        Dashboard
      </Button>
      <Button type="button" class="inline-flex items-center gap-2" onclick={goAdmin}>
        <Settings class="h-4 w-4" aria-hidden="true" />
        Admin
      </Button>
    </div>

    {#if route === "admin"}
      <AdminPage {gateway} />
    {:else}
      <div class="flex flex-wrap items-center gap-2" role="tablist" aria-label="Dashboard mode">
        <Button type="button" color={editorOpen ? "alternative" : "brand"} onclick={selectDashboardView}>
          Dashboard
        </Button>
        <Button type="button" color={editorOpen ? "brand" : "alternative"} onclick={() => (editorOpen = true)}>
          Edit layout
        </Button>
        {#if editorOpen}
          <Button
            type="button"
            color="danger"
            class="outline"
            aria-label="Reset dashboard layout to saved baseline"
            onclick={resetLayoutToBaseline}
          >
            Reset
          </Button>
        {/if}
      </div>

      {#if loadError}
        <p class="text-red-600 dark:text-red-400" role="alert">{loadError}</p>
      {:else}
        <DashboardHost
          {layout}
          {gateway}
          {liveCpuPercent}
          {plugins}
          editLayout={editorOpen}
          onAddTile={addTile}
          onAddGroup={addGroup}
          onAddTileToGroup={addTileToGroup}
          onLayoutStructureChange={applyLayoutStructure}
          onEditTile={openTileSettings}
          onEditGroup={openGroupSettings}
          onDeleteRootItem={deleteRootLayoutItem}
          onDeleteGroupChildTile={deleteGroupChildTile}
          onPerfTileGridHint={onPerfTileGridHint}
        />
      {/if}

      {#if settingsTile}
        {#key settingsTile.id}
          <TileSettingsOverlay
            tile={settingsTile}
            {plugins}
            parentOptions={parentOptions}
            initialParentId={settingsParentId}
            containerWidthColumns={settingsTileContainerG}
            containerGroups={tileSettingsContainerMeta}
            onClose={closeTileSettings}
            onSave={saveTileFromOverlay}
          />
        {/key}
      {/if}
      {#if settingsGroup}
        {#key settingsGroup.id}
          <GroupSettingsOverlay group={settingsGroup} onClose={closeGroupSettings} onSave={saveGroupFromOverlay} />
        {/key}
      {/if}
    {/if}
  </div>
</main>
