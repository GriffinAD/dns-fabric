<script lang="ts">
  import { onMount, setContext } from "svelte";

  import type { PluginEntry } from "../../api/types";
  import { attachFabricBusKernel } from "../../dashboard/fabricBusKernel";
  import { FABRIC_EVENT_BUS } from "../../dashboard/eventBus";
  import { attachCpFabricTransport } from "../../dashboard/transports/cpFabricTransport";
  import type { PiholeCpDashboardGateway } from "../gateway/PiholeCpDashboardGateway";
  import { waitForPiholeCpDashboardCoherent, type PiholeCpMeta } from "../gateway/PiholeCpGateway";
  import LogStreamPanel from "../logs/LogStreamPanel.svelte";
  import type { DashboardResponse } from "../layout/dashboardZod";
  import { mergeOperatorPluginsForPiholeCp } from "../plugins/operatorBaselinePlugins";
  import { createPiholeCpSession } from "../piholeCpSession";
  import PiholeCpDashboardShell from "./PiholeCpDashboardShell.svelte";

  let error = $state<string | null>(null);
  let dashboard = $state<DashboardResponse | null>(null);
  let meta = $state<PiholeCpMeta | null>(null);
  let refreshing = $state(false);
  /** Bumps after env apply so the dashboard shell re-picks layout from server + meta. */
  let layoutResyncEpoch = $state(0);
  /** Bumps when the user hits Refresh so LogStreamPanel reloads its catalogue. */
  let dataRefreshEpoch = $state(0);

  const baseUrl =
    typeof import.meta.env.VITE_PIHOLE_CP_BASE_URL === "string"
      ? import.meta.env.VITE_PIHOLE_CP_BASE_URL
      : "";

  const session = createPiholeCpSession(baseUrl);
  /** Kea API + layout no-op; perf gauges use the control-plane `/v1/node/perf/summary`. */
  const gateway = session.dashboardGateway;
  const fabricBusKernel = attachFabricBusKernel({
    gateway,
    registerCpTransports: (bus, gw) =>
      attachCpFabricTransport(bus, gw as PiholeCpDashboardGateway),
  });
  setContext(FABRIC_EVENT_BUS, fabricBusKernel.bus);

  let apiPlugins = $state<PluginEntry[] | null>(null);

  const plugins = $derived(mergeOperatorPluginsForPiholeCp(apiPlugins, dashboard, meta));

  let fabricSseRelease: (() => void) | null = null;
  let lastKeaApiOrigin = "";

  function syncFabricSseAfterKeaBaseChange(): void {
    const next = gateway.getResolvedApiBaseUrl().trim();
    if (!next) {
      fabricSseRelease?.();
      fabricSseRelease = null;
      lastKeaApiOrigin = "";
      return;
    }
    if (fabricSseRelease == null) {
      fabricSseRelease = fabricBusKernel.bus.connect();
      lastKeaApiOrigin = next;
      return;
    }
    if (next !== lastKeaApiOrigin) {
      fabricSseRelease();
      fabricSseRelease = fabricBusKernel.bus.connect();
      lastKeaApiOrigin = next;
    }
  }

  /** Refresh dashboard/meta after env apply without replacing the whole page with an error banner. */
  async function reloadDashboardAfterEnvMutation(
    report?: (label: string) => void,
  ): Promise<void> {
    if (!dashboard) return;
    const { dashboard: dash, meta: m } = await waitForPiholeCpDashboardCoherent(session.controlPlane, {
      onProgress: report,
    });
    gateway.setKeaFabricApiBaseUrl(m.kea_fabric_api_base_url ?? "");
    syncFabricSseAfterKeaBaseChange();
    try {
      const pluginsRes = await gateway.listPlugins();
      apiPlugins = pluginsRes.items;
    } catch {
      apiPlugins = [];
    }
    dashboard = dash;
    meta = m;
    dataRefreshEpoch += 1;
    layoutResyncEpoch += 1;
  }

  async function loadAll(opts?: { userRefresh?: boolean }) {
    const userRefresh = opts?.userRefresh === true;
    error = null;
    if (userRefresh) refreshing = true;
    try {
      const [dash, m] = await Promise.all([
        session.controlPlane.getDashboard(),
        session.controlPlane.getMeta(),
      ]);
      gateway.setKeaFabricApiBaseUrl(m.kea_fabric_api_base_url ?? "");
      syncFabricSseAfterKeaBaseChange();
      void gateway
        .listPlugins()
        .then((r) => {
          apiPlugins = r.items;
        })
        .catch(() => {
          apiPlugins = [];
        });
      dashboard = dash;
      meta = m;
      if (userRefresh) {
        dataRefreshEpoch += 1;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (userRefresh) refreshing = false;
    }
  }

  onMount(() => {
    void loadAll();
    return () => {
      fabricSseRelease?.();
      fabricSseRelease = null;
      fabricBusKernel.dispose();
    };
  });
</script>

<main class="min-h-screen bg-slate-100 dark:bg-gray-900">
  {#if error}
    <p class="p-4 text-red-600">{error}</p>
  {:else if !dashboard}
    <p class="p-4 text-slate-600 dark:text-gray-400">Loading…</p>
  {:else}
    <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PiholeCpDashboardShell
        {dashboard}
        {meta}
        {gateway}
        {plugins}
        {baseUrl}
        dataRefreshEpoch={dataRefreshEpoch}
        {layoutResyncEpoch}
        {refreshing}
        onRefresh={() => void loadAll({ userRefresh: true })}
        onEnvApplied={(report) => reloadDashboardAfterEnvMutation(report)}
      />
      <LogStreamPanel {baseUrl} controlPlane={session.controlPlane} dataRefreshEpoch={dataRefreshEpoch} />
    </div>
  {/if}
</main>
