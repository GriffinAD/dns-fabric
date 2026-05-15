<script lang="ts" module>
  import type { Component } from "svelte";

  import type { TileHostContext } from "../plugins/registry";
  import {
    registerDynamicPluginPrefixResolver,
    registerDynamicPluginResolver,
  } from "../plugins/registry";
  import PiholeHaSectionPluginTile from "./PiholeHaSectionPluginTile.svelte";

  function piholeHaTileMount(ctx: TileHostContext) {
    return {
      component: PiholeHaSectionPluginTile as Component<Record<string, unknown>>,
      props: { tile: ctx.tile },
    };
  }

  registerDynamicPluginResolver("pihole_ha.section", piholeHaTileMount);
  registerDynamicPluginPrefixResolver("pihole_ha.", ["pihole_ha.section"], piholeHaTileMount);
</script>

<script lang="ts">
  import { get } from "svelte/store";

  import type { PluginEntry } from "../api/types";
  import ThemeControls from "../theme/ThemeControls.svelte";
  import DashboardPage from "../dashboard/DashboardPage.svelte";
  import { handlePerfTileGridHint as applyPerfTileGridHint } from "../dashboard/gridHints";
  import { loadDashboardLayout } from "../dashboard/layoutStorage";
  import { createLayoutStore } from "../dashboard/layoutStore";
  import { createOverlayActions } from "../dashboard/overlayActions";
  import type { DashboardGroup, DashboardTile } from "../dashboard/types";
  import type { DataGateway } from "../dataGateway";
  import {
    layoutContainsPiholeCpKeaDisabledTiles,
    mergeNewServerWidgetsIntoLayout,
    pickInitialPiholeCpLayout,
    PIHOLE_CP_LAYOUT_STORAGE_KEY,
    stripPiholeCpLayoutWhenKeaDhcpDisabled,
  } from "./buildLayoutFromDashboard";
  import type { DashboardResponse } from "./dashboardZod";
  import type { PiholeCpMeta } from "./PiholeCpGateway";
  import { piholeCpDashboardData } from "./piholeCpDashboardDataStore";

  let {
    dashboard,
    meta,
    gateway,
    plugins,
    dataRefreshEpoch = 0,
    refreshing = false,
    onRefresh,
  }: {
    dashboard: DashboardResponse;
    meta: PiholeCpMeta | null;
    gateway: DataGateway;
    plugins: PluginEntry[];
    dataRefreshEpoch?: number;
    refreshing?: boolean;
    onRefresh: () => void;
  } = $props();

  const stored = loadDashboardLayout(PIHOLE_CP_LAYOUT_STORAGE_KEY);
  /* Layout store is seeded from the first dashboard snapshot; widget-set drift is corrected in `$effect`. */
  // svelte-ignore state_referenced_locally
  const initial = pickInitialPiholeCpLayout(dashboard, stored, meta);

  let settingsTile = $state<DashboardTile | null>(null);
  let settingsGroup = $state<DashboardGroup | null>(null);

  // svelte-ignore state_referenced_locally — `gateway` is owned by the parent and stable for this shell.
  const ls = createLayoutStore({
    gateway,
    dashboardId: "pihole-cp",
    initialLayout: initial,
    layoutStorageKey: PIHOLE_CP_LAYOUT_STORAGE_KEY,
    skipServerLayoutPersist: true,
  });

  const overlay = createOverlayActions({
    getLayout: () => get(ls.layout),
    getEditorOpen: () => get(ls.editorOpen),
    getSettingsTile: () => settingsTile,
    getSettingsGroup: () => settingsGroup,
    setSettingsTile: (t) => {
      settingsTile = t;
    },
    setSettingsGroup: (g) => {
      settingsGroup = g;
    },
    applyLayoutStructure: ls.applyStructure,
  });

  const {
    layout,
    loadError,
    persistError,
    editorOpen,
    localPersistBlocked,
    localPersistBlockedReason,
  } = ls;

  function onPerfTileGridHint(tileId: string, hint: { colSpan: number; rowSpan: number }) {
    applyPerfTileGridHint(get(ls.layout).items, tileId, hint, ls.applyStructure);
  }

  $effect(() => {
    void dataRefreshEpoch;
    void dashboard;
    void meta;
    piholeCpDashboardData.set(dashboard);
    let cur = get(ls.layout);
    if (layoutContainsPiholeCpKeaDisabledTiles(cur, meta, dashboard)) {
      ls.applyStructure(stripPiholeCpLayoutWhenKeaDhcpDisabled(cur, meta, dashboard), { skipHistory: true });
      cur = get(ls.layout);
    }
    const merged = mergeNewServerWidgetsIntoLayout(cur, dashboard, meta);
    if (merged) {
      ls.applyStructure(merged, { skipHistory: true });
    }
  });

  async function toggleLayoutEdit() {
    if (get(ls.editorOpen)) {
      await ls.closeEditorAndFlush();
    } else {
      ls.openEditor();
    }
  }
</script>

<header
  class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
>
  <div class="min-w-0">
    <h1 class="text-lg font-semibold text-slate-900 dark:text-gray-100">Pi-hole HA control plane</h1>
    <p class="truncate text-sm text-slate-600 dark:text-gray-400">
      Node <span class="font-mono">{meta?.node ?? dashboard.node}</span>
      · v<span class="font-mono">{dashboard.version}</span>
    </p>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex items-center gap-1" data-testid="pihole-cp-theme-controls">
      <ThemeControls showAccent={false} showGaugeSegmentToggle={false} />
    </div>
    <button
      type="button"
      class="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:text-gray-100"
      aria-pressed={$editorOpen}
      aria-label={$editorOpen ? "Done editing layout" : "Edit layout"}
      title={$editorOpen ? "Done editing layout" : "Edit layout — palette, containers, and grid"}
      data-testid="pihole-cp-layout-edit-toggle"
      onclick={() => void toggleLayoutEdit()}
    >
      {$editorOpen ? "Done" : "Edit layout"}
    </button>
    {#if meta?.peer_ui_base_url}
      <a
        class="text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        href={meta.peer_ui_base_url}
        target="_blank"
        rel="noreferrer"
      >
        Peer UI
      </a>
    {/if}
    <button
      type="button"
      class="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-600 dark:text-gray-100"
      disabled={refreshing}
      data-testid="pihole-cp-refresh"
      onclick={onRefresh}
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  </div>
</header>

<!-- Inherited `--dashboard-gap` spaces tiles on `[data-dashboard-tile-grid]` and the layout editor (app.css). -->
<div class="mt-4 [--dashboard-gap:5px]">
  <DashboardPage
    {gateway}
    {plugins}
    layout={$layout}
    editLayout={$editorOpen}
    loadError={$loadError}
    persistError={$persistError}
    localPersistBlocked={$localPersistBlocked}
    localPersistBlockedReason={$localPersistBlockedReason}
    settingsTile={settingsTile}
    settingsGroup={settingsGroup}
    {ls}
    {overlay}
    {onPerfTileGridHint}
  />
</div>
