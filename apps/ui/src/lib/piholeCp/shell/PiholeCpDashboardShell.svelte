<script lang="ts" module>
  import type { Component } from "svelte";

  import type { TileHostContext } from "../../plugins/core/registry";
  import {
    registerDynamicPluginPrefixResolver,
    registerDynamicPluginResolver,
  } from "../../plugins/core/registry";
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

  import type { PluginEntry } from "../../api/types";
  import DashboardPage from "../../dashboard/DashboardPage.svelte";
  import { handlePerfTileGridHint as applyPerfTileGridHint } from "../../dashboard/gridHints";
  import { loadDashboardLayout } from "../../dashboard/layoutStorage";
  import { createLayoutStore } from "../../dashboard/layoutStore";
  import { createOverlayActions } from "../../dashboard/overlayActions";
  import type { DashboardGroup, DashboardTile } from "../../dashboard/types";
  import type { DataGateway } from "../../dataGateway";
  import {
    layoutContainsPiholeCpKeaDisabledTiles,
    mergeNewServerWidgetsIntoLayout,
    pickInitialPiholeCpLayout,
    PIHOLE_CP_LAYOUT_STORAGE_KEY,
    stripPiholeCpLayoutWhenKeaDhcpDisabled,
  } from "../layout/buildLayoutFromDashboard";
  import type { DashboardResponse } from "../layout/dashboardZod";
  import type { PiholeCpMeta } from "../gateway/PiholeCpGateway";
  import PiholeCpEnvSettings from "../env/PiholeCpEnvSettings.svelte";
  import PiholeCpShellHeader from "./PiholeCpShellHeader.svelte";
  import { piholeCpDashboardData } from "../store/piholeCpDashboardDataStore";
  import {
    formatPiholeCpUiDisplayVersion,
    readPiholeCpUiBuildFromEnv,
  } from "../meta/piholeCpUiVersion";

  let {
    dashboard,
    meta,
    gateway,
    plugins,
    baseUrl,
    dataRefreshEpoch = 0,
    layoutResyncEpoch = 0,
    refreshing = false,
    onRefresh,
    onEnvApplied,
  }: {
    dashboard: DashboardResponse;
    meta: PiholeCpMeta | null;
    gateway: DataGateway;
    plugins: PluginEntry[];
    baseUrl: string;
    dataRefreshEpoch?: number;
    layoutResyncEpoch?: number;
    refreshing?: boolean;
    onRefresh: () => void;
    onEnvApplied?: (report?: (label: string) => void) => void | Promise<void>;
  } = $props();

  const uiDisplayVersion = $derived(
    formatPiholeCpUiDisplayVersion(dashboard.version, readPiholeCpUiBuildFromEnv()),
  );

  const stored = loadDashboardLayout(PIHOLE_CP_LAYOUT_STORAGE_KEY);
  // svelte-ignore state_referenced_locally
  const initial = pickInitialPiholeCpLayout(dashboard, stored, meta);

  let settingsTile = $state<DashboardTile | null>(null);
  let settingsGroup = $state<DashboardGroup | null>(null);

  // svelte-ignore state_referenced_locally
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
    void layoutResyncEpoch;
    void dashboard;
    void meta;
    piholeCpDashboardData.set(dashboard);
    if (layoutResyncEpoch > 0) {
      const stored = loadDashboardLayout(PIHOLE_CP_LAYOUT_STORAGE_KEY);
      const fresh = pickInitialPiholeCpLayout(dashboard, stored, meta);
      ls.applyStructure(stripPiholeCpLayoutWhenKeaDhcpDisabled(fresh, meta, dashboard), {
        skipHistory: true,
      });
    }
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
</script>

<div
  class="sticky top-0 z-40 -mx-4 border-b border-slate-200/90 bg-slate-100/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6 dark:border-gray-700/90 dark:bg-gray-900/95"
  data-testid="pihole-cp-sticky-chrome"
>
  <PiholeCpShellHeader
    nodeLabel={meta?.node ?? dashboard.node}
    uiVersion={uiDisplayVersion}
    editorOpen={$editorOpen}
    {ls}
    {refreshing}
    peerUiBaseUrl={meta?.peer_ui_base_url ?? null}
    onOpenEditor={() => ls.openEditor()}
    onCloseEditor={() => ls.closeEditorAndFlush()}
    onResetBaseline={() => ls.resetToBaseline()}
    onSaveLayout={() => ls.saveLayoutToFile()}
    onRefresh={onRefresh}
  />
</div>

{#if $editorOpen}
  <div class="mt-4" data-testid="pihole-cp-node-settings-panel">
    <PiholeCpEnvSettings {baseUrl} onApplied={onEnvApplied} />
  </div>
{/if}

<!-- Tile gap from `--dashboard-gap` on document root (DashboardControls / piholeCp-entry). -->
<div class="mt-6">
  <DashboardPage
    {gateway}
    {plugins}
    layout={$layout}
    editLayout={$editorOpen}
    loadError={$loadError}
    persistError={$persistError}
    localPersistBlocked={$localPersistBlocked}
    localPersistBlockedReason={$localPersistBlockedReason}
    {settingsTile}
    {settingsGroup}
    {ls}
    {overlay}
    {onPerfTileGridHint}
    hideEditorToolbar
  />
</div>
