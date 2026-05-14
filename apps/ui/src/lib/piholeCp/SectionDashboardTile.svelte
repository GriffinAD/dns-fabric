<script lang="ts">
  import { asRecord, boolish, str } from "./sectionUi";

  let { section, title, payload }: { section: string; title: string; payload: unknown } = $props();

  const p = $derived(asRecord(payload));
</script>

<section
  class="rounded-lg border border-slate-200 bg-white p-3 pt-9 shadow-sm dark:border-gray-700 dark:bg-gray-900"
>
  <h2 class="mb-3 text-sm font-semibold text-slate-900 dark:text-gray-100">{title}</h2>

  {#if section === "ha" && p}
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
    {#if asRecord(p.vrrp)}
      {@const v = asRecord(p.vrrp)!}
      <div class="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p class="font-medium">VRRP</p>
        <p class="mt-1">{boolish(v.available) ? "Available" : "Not available in container"}</p>
        {#if typeof v.detail === "string"}
          <p class="mt-1 text-amber-900/90 dark:text-amber-200/90">{v.detail}</p>
        {/if}
      </div>
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
      <ul class="space-y-2 text-xs">
        {#each p.containers as row (String((row as { name?: string }).name))}
          {@const r = asRecord(row)}
          {#if r}
            <li
              class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1.5 dark:border-gray-800"
            >
              <span class="font-mono font-medium text-slate-800 dark:text-gray-200">{str(r.name) ?? "?"}</span>
              <span class="flex flex-wrap gap-1">
                {#if typeof r.status === "string"}
                  <span
                    class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-700 dark:bg-gray-800 dark:text-gray-300"
                    >{r.status}</span
                  >
                {/if}
                {#if r.running === true}
                  <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    >running</span
                  >
                {:else if r.running === false}
                  <span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-gray-700 dark:text-gray-300"
                    >stopped</span
                  >
                {/if}
                {#if typeof r.health === "string"}
                  <span class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
                    >{r.health}</span
                  >
                {/if}
              </span>
            </li>
          {/if}
        {/each}
      </ul>
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
      <ul class="space-y-2 text-xs">
        {#each ["nebula_sync", "dnscrypt_proxy", "kea_dhcp4", "kea_ctrl_agent"] as key (key)}
          {@const row = asRecord(p[key])}
          {#if row}
            <li
              class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1.5 dark:border-gray-800"
            >
              <span class="font-mono text-slate-800 dark:text-gray-200">{str(row.name) ?? key}</span>
              <span class="flex flex-wrap gap-1">
                {#if typeof row.status === "string"}
                  <span
                    class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-700 dark:bg-gray-800 dark:text-gray-300"
                    >{row.status}</span
                  >
                {/if}
                {#if row.running === true}
                  <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    >running</span
                  >
                {:else if row.running === false}
                  <span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-gray-700 dark:text-gray-300"
                    >stopped</span
                  >
                {/if}
                {#if typeof row.health === "string"}
                  <span class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
                    >{row.health}</span
                  >
                {/if}
              </span>
            </li>
          {/if}
        {/each}
      </ul>
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
    {#if asRecord(p.container)}
      {@const c = asRecord(p.container)!}
      <p class="text-xs font-medium text-slate-700 dark:text-gray-300">Container</p>
      <div class="mt-1 flex flex-wrap gap-1 text-xs">
        {#if typeof c.status === "string"}
          <span
            class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase dark:bg-gray-800 dark:text-gray-300"
            >{c.status}</span
          >
        {/if}
        {#if c.running === true}
          <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] dark:bg-emerald-900/40 dark:text-emerald-200"
            >running</span
          >
        {:else if c.running === false}
          <span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] dark:bg-gray-700 dark:text-gray-300"
            >stopped</span
          >
        {/if}
      </div>
    {:else}
      <p class="text-xs text-slate-500 dark:text-gray-500">No container row (see core stack)</p>
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
