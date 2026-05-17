<script lang="ts">
  import { onMount } from "svelte";

  import {
    asRecord,
    boolish,
    containerHealthSuffix,
    containerLifecycleLabel,
    containerLifecycleTone,
    containerUptimeLabel,
    filterDeployedContainerRows,
    isDeployedContainerRow,
    str,
  } from "./sectionUi";

  let {
    section,
    title,
    payload,
    view,
  }: { section: string; title: string; payload: unknown; view?: string } = $props();

  /** Wall clock for live container uptime (rows expose `started_at` or `uptime_seconds` from the API). */
  let nowMs = $state(Date.now());
  onMount(() => {
    const id = setInterval(() => {
      nowMs = Date.now();
    }, 30_000);
    return () => clearInterval(id);
  });

  const p = $derived(asRecord(payload));
  /** `ha` section: optional slice from `/dashboard` widgets so each slice is its own dashboard tile. */
  const haSlice = $derived.by(() => {
    if (!view) return "full";
    if (view === "ha_status" || view === "ha_network" || view === "ha_services") return view;
    return "full";
  });
</script>

<section
  class="rounded-lg border border-slate-200 bg-white p-3 pt-9 shadow-sm dark:border-gray-700 dark:bg-gray-900"
>
  <h2 class="mb-3 text-sm font-semibold text-slate-900 dark:text-gray-100">{title}</h2>

  {#if section === "ha" && p}
    {#if haSlice === "full" || haSlice === "ha_status" || haSlice === "ha_network" || haSlice === "ha_services"}
      <div class="mb-2 flex items-center gap-2">
        <span
          class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
            ? 'bg-emerald-500'
            : 'bg-red-500'}"
          aria-hidden="true"
        ></span>
        <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
          {boolish(p.ok) ? "OK" : "Issue"}
        </span>
      </div>
    {/if}
    {#if haSlice === "full"}
      <dl class="grid gap-2 text-xs">
        {#each [["VIP", str(p.vip)], ["Router", str(p.router)], ["Pi1", str(p.node_primary_ip)], ["Pi2", str(p.node_secondary_ip)], ["HA node env", str(p.pihole_ha_node)], ["DHCP mode", str(p.dhcp_mode)], ["DNSCrypt enabled", p.dnscrypt_enabled === true ? "yes" : "no"]] as [k, v] (k)}
          {#if v}
            <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
              <dt class="text-slate-500 dark:text-gray-500">{k}</dt>
              <dd class="font-mono text-right text-slate-800 dark:text-gray-200">{v}</dd>
            </div>
          {/if}
        {/each}
      </dl>
    {:else if haSlice === "ha_status"}
      {#if typeof p.error === "string"}
        <p class="text-xs text-red-600 dark:text-red-400">{p.error}</p>
      {/if}
    {:else if haSlice === "ha_network"}
      <dl class="grid gap-2 text-xs">
        {#each [["VIP", str(p.vip)], ["Router", str(p.router)], ["Pi1", str(p.node_primary_ip)], ["Pi2", str(p.node_secondary_ip)]] as [k, v] (k)}
          {#if v}
            <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
              <dt class="text-slate-500 dark:text-gray-500">{k}</dt>
              <dd class="font-mono text-right text-slate-800 dark:text-gray-200">{v}</dd>
            </div>
          {/if}
        {/each}
      </dl>
    {:else if haSlice === "ha_services"}
      <dl class="grid gap-2 text-xs">
        {#each [["HA node env", str(p.pihole_ha_node)], ["DHCP mode", str(p.dhcp_mode)], ["DNSCrypt enabled", p.dnscrypt_enabled === true ? "yes" : "no"]] as [k, v] (k)}
          {#if v}
            <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
              <dt class="text-slate-500 dark:text-gray-500">{k}</dt>
              <dd class="font-mono text-right text-slate-800 dark:text-gray-200">{v}</dd>
            </div>
          {/if}
        {/each}
      </dl>
    {/if}
  {:else if (section === "peer_telemetry" || section === "peer_dhcp") && p}
    <p class="mb-2 text-xs text-slate-600 dark:text-gray-400">{str(p.detail) ?? "—"}</p>
    {#if str(p.peer_ui_base_url)}
      <p class="mb-2 text-xs text-slate-500 dark:text-gray-500">
        Opens the Kea Fabric operator (same LAN URL as the control plane <code class="font-mono">peer</code> hint).
      </p>
      <a
        class="inline-block rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-700 underline hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-gray-800"
        href={str(p.peer_ui_base_url)!}
        target="_blank"
        rel="noreferrer"
      >
        Open fabric peer UI
      </a>
    {:else}
      <p class="text-xs text-amber-800 dark:text-amber-200">
        Set <span class="font-mono">CONTROL_PLANE_PEER_UI_BASE_URL</span> on the control plane host to enable the
        link (same value as <span class="font-mono">/v1/meta.peer_ui_base_url</span>).
      </p>
    {/if}
  {:else if section === "keepalived" && p}
    <div class="mb-2 flex items-center gap-2">
      <span
        class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
          ? 'bg-emerald-500'
          : 'bg-red-500'}"
        aria-hidden="true"
      ></span>
      <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
        {boolish(p.ok) ? "OK" : "Issue"}
      </span>
    </div>
    {#if str(p.vip)}
      <p class="mb-2 text-xs text-slate-600 dark:text-gray-400">VIP <span class="font-mono">{str(p.vip)}</span></p>
    {/if}
    {#if asRecord(p.tcp_dns_probe)}
      {@const tcp = asRecord(p.tcp_dns_probe)!}
      <div class="mb-2 rounded-md bg-slate-50 p-2 text-xs dark:bg-gray-950">
        <p class="font-medium text-slate-700 dark:text-gray-300">TCP DNS probe</p>
        <p class="mt-1 font-mono text-slate-800 dark:text-gray-200">
          {boolish(tcp.ok) ? "Reachable" : "Unreachable"}
          {#if tcp.reachable === true}<span class="text-emerald-600 dark:text-emerald-400"> · listening</span>{/if}
        </p>
      </div>
    {/if}
    {#if str(p.lan_identity_hint)}
      <p class="mb-2 text-xs text-slate-600 dark:text-gray-400">
        LAN hint: <span class="font-mono">{str(p.lan_identity_hint)}</span>
      </p>
    {/if}
  {:else if section === "docker" && p}
    <div class="mb-2 flex items-center gap-2">
      <span
        class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
          ? 'bg-emerald-500'
          : 'bg-red-500'}"
        aria-hidden="true"
      ></span>
      <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
        {boolish(p.ok) ? "OK" : "Issue"}
      </span>
    </div>
    {#if typeof p.error === "string"}
      <p class="mb-2 text-xs text-red-600 dark:text-red-400">{p.error}</p>
    {/if}
    {#if Array.isArray(p.containers)}
      {@const deployed = filterDeployedContainerRows(p.containers)}
      {#if deployed.length === 0}
        <p class="text-xs text-slate-600 dark:text-gray-400">No deployed containers from the watched list on this node.</p>
      {:else}
        <ul class="space-y-2 text-xs">
          {#each deployed as row (String((row as { name?: string }).name))}
            {@const r = asRecord(row)}
            {#if r}
              {@const life = containerLifecycleLabel(row)}
              {@const tone = containerLifecycleTone(row)}
              {@const healthX = containerHealthSuffix(row)}
              {@const up = containerUptimeLabel(row, nowMs)}
              <li
                class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1.5 dark:border-gray-800"
              >
                <span class="font-mono font-medium text-slate-800 dark:text-gray-200">{str(r.name) ?? "?"}</span>
                <span class="flex flex-wrap items-center gap-1.5">
                  <span
                    class="rounded px-1.5 py-0.5 font-mono text-[10px] capitalize {tone === 'ok'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                      : tone === 'bad'
                        ? 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200'
                        : tone === 'warn'
                          ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                          : 'bg-slate-100 text-slate-800 dark:bg-gray-800 dark:text-gray-200'}"
                    >{life}</span
                  >
                  {#if healthX}
                    <span class="text-[10px] text-slate-600 dark:text-gray-400">· {healthX}</span>
                  {/if}
                  {#if up}
                    <span class="text-[10px] text-slate-600 dark:text-gray-400" title="Uptime since container start"
                      >· up {up}</span
                    >
                  {/if}
                </span>
              </li>
            {/if}
          {/each}
        </ul>
      {/if}
    {/if}
  {:else if section === "pihole_dns" && p}
    <div class="mb-2 flex items-center gap-2">
      <span
        class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
          ? 'bg-emerald-500'
          : 'bg-red-500'}"
        aria-hidden="true"
      ></span>
      <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
        {boolish(p.ok) ? "OK" : "Issue"}
      </span>
    </div>
    {#if !boolish(p.ok) && typeof p.error === "string"}
      <p class="text-xs text-red-600 dark:text-red-400">{p.error}</p>
      {#if typeof p.detail === "string"}
        <p class="mt-1 text-xs text-slate-600 dark:text-gray-400">{p.detail}</p>
      {/if}
    {:else}
      <dl class="grid gap-2 text-xs">
        {#if str(p.listening_mode)}
          <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
            <dt class="text-slate-500 dark:text-gray-500">Listening</dt>
            <dd class="font-mono text-slate-800 dark:text-gray-200">{str(p.listening_mode)}</dd>
          </div>
        {/if}
        {#if typeof p.upstream_count === "number"}
          <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
            <dt class="text-slate-500 dark:text-gray-500">Upstreams</dt>
            <dd class="font-mono text-slate-800 dark:text-gray-200">{p.upstream_count}</dd>
          </div>
        {/if}
        {#if Array.isArray(p.upstreams_preview) && p.upstreams_preview.length > 0}
          <div>
            <dt class="mb-1 text-slate-500 dark:text-gray-500">Preview</dt>
            <dd>
              <ul class="flex flex-wrap gap-1">
                {#each p.upstreams_preview as u (String(u))}
                  <li
                    class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:bg-gray-800 dark:text-gray-200"
                  >
                    {String(u)}
                  </li>
                {/each}
              </ul>
              {#if p.upstreams_truncated === true}
                <p class="mt-1 text-[10px] text-slate-500 dark:text-gray-500">List truncated</p>
              {/if}
            </dd>
          </div>
        {/if}
      </dl>
    {/if}
  {:else if section === "pihole_runtime" && p}
    <div class="mb-2 flex items-center gap-2">
      <span
        class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
          ? 'bg-emerald-500'
          : 'bg-red-500'}"
        aria-hidden="true"
      ></span>
      <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
        {boolish(p.ok) ? "OK" : "Issue"}
      </span>
    </div>
    {#if typeof p.error === "string"}
      <p class="text-xs text-red-600 dark:text-red-400">{p.error}</p>
    {/if}
    {#if typeof p.exit_code === "number"}
      <p class="mb-2 text-xs text-slate-600 dark:text-gray-400">Exit code: <span class="font-mono">{p.exit_code}</span></p>
    {/if}
    {#if typeof p.output === "string" && p.output.length > 0}
      <pre
        class="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 font-mono text-[11px] text-slate-800 dark:bg-gray-950 dark:text-gray-200"
        >{p.output}</pre
      >
    {/if}
  {:else if section === "kea_dhcp" && p}
    <div class="mb-2 flex items-center gap-2">
      <span
        class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
          ? 'bg-emerald-500'
          : 'bg-red-500'}"
        aria-hidden="true"
      ></span>
      <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
        {boolish(p.ok) ? "OK" : "Issue"}
      </span>
    </div>
    {#if !boolish(p.ok)}
      <p class="text-xs text-red-600 dark:text-red-400">{typeof p.error === "string" ? p.error : "Unknown error"}</p>
      {#if typeof p.detail === "string"}
        <p class="mt-1 text-xs text-slate-600 dark:text-gray-400">{p.detail}</p>
      {/if}
    {:else}
      <dl class="grid gap-2 text-xs">
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
          <dt class="text-slate-500 dark:text-gray-500">Interfaces (count)</dt>
          <dd class="font-mono text-slate-800 dark:text-gray-200">{String(p.interface_entries ?? "—")}</dd>
        </div>
        {#if str(p.lease_database_type)}
          <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
            <dt class="text-slate-500 dark:text-gray-500">Lease DB</dt>
            <dd class="font-mono text-slate-800 dark:text-gray-200">{str(p.lease_database_type)}</dd>
          </div>
        {/if}
      </dl>
    {/if}
  {:else if section === "stack" && p}
    <div class="mb-2 flex items-center gap-2">
      <span
        class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
          ? 'bg-emerald-500'
          : 'bg-red-500'}"
        aria-hidden="true"
      ></span>
      <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
        {boolish(p.ok) ? "OK" : "Issue"}
      </span>
    </div>
    {#if typeof p.error === "string"}
      <p class="text-xs text-red-600 dark:text-red-400">{p.error}</p>
    {/if}
    {#if boolish(p.ok)}
      {@const stackKeys = ["nebula_sync", "dnscrypt_proxy", "kea_dhcp4", "kea_ctrl_agent"] as const}
      {@const stackRows = stackKeys.map((k) => asRecord(p[k])).filter((row): row is Record<string, unknown> => Boolean(row && isDeployedContainerRow(row)))}
      {#if stackRows.length === 0}
        <p class="text-xs text-slate-600 dark:text-gray-400">No optional stack services from the watched list on this node.</p>
      {:else}
        <ul class="space-y-2 text-xs">
          {#each stackKeys as key (key)}
            {@const row = asRecord(p[key])}
            {#if row && isDeployedContainerRow(row)}
              {@const life = containerLifecycleLabel(row)}
              {@const tone = containerLifecycleTone(row)}
              {@const healthX = containerHealthSuffix(row)}
              {@const up = containerUptimeLabel(row, nowMs)}
              <li
                class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1.5 dark:border-gray-800"
              >
                <span class="font-mono text-slate-800 dark:text-gray-200">{str(row.name) ?? key}</span>
                <span class="flex flex-wrap items-center gap-1.5">
                  <span
                    class="rounded px-1.5 py-0.5 font-mono text-[10px] capitalize {tone === 'ok'
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                      : tone === 'bad'
                        ? 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200'
                        : tone === 'warn'
                          ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                          : 'bg-slate-100 text-slate-800 dark:bg-gray-800 dark:text-gray-200'}"
                    >{life}</span
                  >
                  {#if healthX}
                    <span class="text-[10px] text-slate-600 dark:text-gray-400">· {healthX}</span>
                  {/if}
                  {#if up}
                    <span class="text-[10px] text-slate-600 dark:text-gray-400" title="Uptime since container start"
                      >· up {up}</span
                    >
                  {/if}
                </span>
              </li>
            {/if}
          {/each}
        </ul>
      {/if}
      {#if asRecord(p.nebula_cron) && str(asRecord(p.nebula_cron)!.cron)}
        <p class="mt-2 text-xs text-slate-600 dark:text-gray-400">
          Nebula CRON env: <span class="font-mono">{str(asRecord(p.nebula_cron)!.cron)}</span>
        </p>
      {/if}
    {/if}
  {:else if section === "schedules" && p}
    <div class="mb-2 flex items-center gap-2">
      <span
        class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
          ? 'bg-emerald-500'
          : 'bg-red-500'}"
        aria-hidden="true"
      ></span>
      <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
        {boolish(p.ok) ? "OK" : "Issue"}
      </span>
    </div>
    {#if str(p.nebula_sync_cron)}
      <p class="mb-2 text-xs text-slate-700 dark:text-gray-300">
        <span class="text-slate-500 dark:text-gray-500">Nebula sync schedule</span><br />
        <span class="font-mono text-sm">{str(p.nebula_sync_cron)}</span>
        <span class="ml-2 text-[10px] text-slate-500 dark:text-gray-500">(container CRON)</span>
      </p>
    {/if}
    {#if Array.isArray(p.notes)}
      <ul class="list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-gray-400">
        {#each p.notes as note (String(note))}
          <li>{String(note)}</li>
        {/each}
      </ul>
    {/if}
  {:else if section === "dnscrypt" && p}
    <div class="mb-2 flex items-center gap-2">
      <span
        class="inline-flex h-2 w-2 rounded-full {boolish(p.ok)
          ? 'bg-emerald-500'
          : 'bg-red-500'}"
        aria-hidden="true"
      ></span>
      <span class="text-xs font-medium text-slate-600 dark:text-gray-400">
        {boolish(p.ok) ? "OK" : "Issue"}
      </span>
    </div>
    <dl class="mb-2 grid gap-2 text-xs">
      <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
        <dt class="text-slate-500 dark:text-gray-500">Enabled in .env</dt>
        <dd class="font-mono text-slate-800 dark:text-gray-200">{p.env_enabled === true ? "yes" : "no"}</dd>
      </div>
      {#if str(p.env_port)}
        <div class="flex justify-between gap-3 border-b border-slate-100 pb-1 dark:border-gray-800">
          <dt class="text-slate-500 dark:text-gray-500">Port</dt>
          <dd class="font-mono text-slate-800 dark:text-gray-200">{str(p.env_port)}</dd>
        </div>
      {/if}
    </dl>
    {#if asRecord(p.container) && isDeployedContainerRow(p.container)}
      {@const c = asRecord(p.container)!}
      {@const life = containerLifecycleLabel(c)}
      {@const tone = containerLifecycleTone(c)}
      {@const healthX = containerHealthSuffix(c)}
      <p class="text-xs font-medium text-slate-700 dark:text-gray-300">Container</p>
      <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
        <span
          class="rounded px-1.5 py-0.5 font-mono text-[10px] capitalize {tone === 'ok'
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
            : tone === 'bad'
              ? 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200'
              : tone === 'warn'
                ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                : 'bg-slate-100 text-slate-800 dark:bg-gray-800 dark:text-gray-200'}"
          >{life}</span
        >
        {#if healthX}
          <span class="text-[10px] text-slate-600 dark:text-gray-400">· {healthX}</span>
        {/if}
      </div>
    {:else}
      <p class="text-xs text-slate-500 dark:text-gray-500">DNSCrypt container not present on this node.</p>
    {/if}
  {:else}
    <p class="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-gray-500">
      Raw section · {section}
    </p>
    <pre class="max-h-64 overflow-auto text-xs text-slate-800 dark:text-gray-200">{JSON.stringify(
        payload,
        null,
        2,
      )}</pre>
  {/if}
</section>
