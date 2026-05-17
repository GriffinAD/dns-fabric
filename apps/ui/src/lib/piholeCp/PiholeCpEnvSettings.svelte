<script lang="ts">
  import Spinner from "flowbite-svelte/Spinner.svelte";
  import { tick } from "svelte";

  import type { EnvConfigResponse, EnvSchemaEntry } from "./envConfigZod";
  import {
    PiholeCpGateway,
    waitForHostEnvApplyComplete,
  } from "./PiholeCpGateway";
  import { readPiholeCpApiToken, writePiholeCpApiToken } from "./piholeCpApiToken";

  let {
    baseUrl,
    alwaysOpen = false,
    onApplied,
  }: {
    baseUrl: string;
    /** When true, panel is always expanded (e.g. layout edit mode). */
    alwaysOpen?: boolean;
    onApplied?: (report?: (label: string) => void) => void | Promise<void>;
  } = $props();

  let busy = $state(false);
  let busyLabel = $state<string | null>(null);

  let schemaKeys = $state<EnvSchemaEntry[]>([]);
  let config = $state<EnvConfigResponse | null>(null);
  let draft = $state<Record<string, string>>({});
  let apiTokenInput = $state(readPiholeCpApiToken());
  let statusMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);
  let open = $state(false);

  const panelOpen = $derived(alwaysOpen || open);
  const writableKeys = $derived(schemaKeys.filter((e) => e.tier !== 3 && !e.readonly));
  const secretKeys = $derived(schemaKeys.filter((e) => e.tier === 3 || e.sensitive));

  function setProgress(label: string | null) {
    busyLabel = label;
  }

  async function loadConfig() {
    errorMsg = null;
    const gw = new PiholeCpGateway(baseUrl);
    const [schema, env] = await Promise.all([gw.getEnvSchema(), gw.getEnvConfig()]);
    schemaKeys = schema.keys;
    config = env;
    draft = { ...env.effective, ...(env.pending ?? {}) };
  }

  function mutationToken(): string {
    writePiholeCpApiToken(apiTokenInput);
    return readPiholeCpApiToken();
  }

  async function run(mutate: () => Promise<void>, initialLabel = "Working…") {
    busy = true;
    busyLabel = initialLabel;
    errorMsg = null;
    statusMsg = null;
    await tick();
    try {
      await mutate();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
      busyLabel = null;
    }
  }

  async function saveDraft() {
    const token = mutationToken();
    if (!token) {
      errorMsg = "API token required for mutations.";
      return;
    }
    const changes: Record<string, string> = {};
    for (const entry of writableKeys) {
      const key = entry.key;
      const next = draft[key];
      const prev = config?.effective[key];
      if (next != null && next !== prev) {
        changes[key] = next;
      }
    }
    if (Object.keys(changes).length === 0) {
      statusMsg = "No changes to stage.";
      return;
    }
    await run(async () => {
      const gw = new PiholeCpGateway(baseUrl);
      const res = await gw.patchEnvConfig(changes, token);
      statusMsg = res.status === 202 ? "Changes staged. Use Apply to merge into .env." : "Changes staged.";
      await loadConfig();
    });
  }

  async function afterHostMutation(
    res: { applied: boolean; summary: string; example?: string; backupPath?: string },
    onDone?: (report?: (label: string) => void) => void | Promise<void>,
  ) {
    statusMsg = res.applied
      ? res.backupPath
        ? `${res.summary} Backup: ${res.backupPath}`
        : res.summary
      : res.example
        ? `${res.summary} Example: ${res.example}`
        : res.summary;
    if (res.applied) {
      const gw = new PiholeCpGateway(baseUrl);
      setProgress("Updating settings and dashboard…");
      try {
        const envTask = (async () => {
          const env = await waitForHostEnvApplyComplete(baseUrl, gw, { onProgress: setProgress });
          schemaKeys = (await gw.getEnvSchema()).keys;
          config = env;
          draft = { ...env.effective };
        })();
        const dashTask = onDone ? Promise.resolve(onDone(setProgress)) : Promise.resolve();
        await Promise.all([envTask, dashTask]);
        statusMsg = "Apply finished. Values below are from the host .env file.";
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        statusMsg = `${res.summary} ${err}`;
        errorMsg =
          "Host apply did not complete. Pending patch was kept so you can retry. On pi2: sudo tail -30 /opt/pihole-ha/data/logs/control-plane-audit.jsonl";
      }
      return;
    }
    setProgress("Refreshing settings…");
    try {
      await loadConfig();
    } catch {
      statusMsg = `${statusMsg} Reload the page to refresh the form.`;
    }
  }

  async function applyStaged() {
    const token = mutationToken();
    if (!token) {
      errorMsg = "API token required.";
      return;
    }
    await run(async () => {
      setProgress("Submitting apply…");
      const gw = new PiholeCpGateway(baseUrl);
      const res = await gw.applyEnvConfig(token);
      await afterHostMutation(res, onApplied);
    }, "Applying…");
  }

  async function rollbackEnv() {
    const token = mutationToken();
    if (!token) {
      errorMsg = "API token required.";
      return;
    }
    await run(async () => {
      setProgress("Submitting rollback…");
      const gw = new PiholeCpGateway(baseUrl);
      const res = await gw.rollbackEnvConfig(token);
      await afterHostMutation(res, onApplied);
    }, "Rolling back…");
  }

  $effect(() => {
    if (panelOpen && schemaKeys.length === 0) {
      void loadConfig().catch((e) => {
        errorMsg = e instanceof Error ? e.message : String(e);
      });
    }
  });

  function inputType(entry: EnvSchemaEntry): string {
    if (entry.type === "integer") return "number";
    if (entry.type === "url") return "url";
    return "text";
  }
</script>

<section
  class="relative rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
  data-testid="pihole-cp-env-settings"
>
  {#if busy}
    <div
      class="env-settings-busy-overlay absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/90 dark:bg-gray-900/90"
      data-testid="env-settings-busy"
      aria-busy="true"
      role="status"
      aria-live="polite"
    >
      <Spinner size="12" type="bars" color="blue" />
      <p class="max-w-[16rem] text-center text-sm font-medium text-slate-800 dark:text-gray-200">
        {busyLabel ?? "Working…"}
      </p>
    </div>
  {/if}
  {#if !alwaysOpen}
    <button
      type="button"
      class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-gray-100"
      onclick={() => {
        open = !open;
      }}
    >
      <span>Node settings (.env)</span>
      <span class="text-xs font-normal text-slate-500 dark:text-gray-400">{open ? "Hide" : "Show"}</span>
    </button>
  {:else}
    <h2 class="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-gray-800 dark:text-gray-100">
      Node settings (.env)
    </h2>
  {/if}
  {#if panelOpen}
    <div class="min-h-[10rem] border-t border-slate-100 px-4 py-3 dark:border-gray-800">
      <p class="mb-3 text-xs text-slate-600 dark:text-gray-400">
        Writable keys from the host <code class="text-[0.7rem]">.env</code> (secrets are listed but not editable).
        Save stages changes; Apply merges on the host and may restart services.
      </p>
      <label class="mb-3 block text-xs">
        <span class="text-slate-500 dark:text-gray-500">API token</span>
        <input
          type="password"
          class="mt-1 block w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs sm:w-1/2 dark:border-gray-700 dark:bg-gray-950"
          bind:value={apiTokenInput}
          autocomplete="off"
          disabled={busy}
          aria-label="API token"
        />
      </label>
      {#if config?.pending}
        <p class="mb-2 text-xs text-amber-800 dark:text-amber-200">
          Pending staged patch: {Object.keys(config.pending).join(", ")}
        </p>
      {/if}
      {#if writableKeys.length > 0}
        <dl class="mb-3 max-h-[min(28rem,50vh)] grid gap-2 overflow-y-auto pr-1">
          {#each writableKeys as entry (entry.key)}
            <div
              class="grid gap-1 text-xs sm:grid-cols-[minmax(0,33%)_minmax(0,66%)] sm:items-start"
            >
              <dt class="min-w-0 text-slate-600 dark:text-gray-400" title={entry.key}>
                {entry.label}
                <span class="block font-mono text-[0.65rem] text-slate-400 dark:text-gray-500">{entry.key}</span>
              </dt>
              <dd class="min-w-0">
                {#if entry.type === "boolean"}
                  <select
                    class="w-auto max-w-full min-w-[7rem] rounded border border-slate-200 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-950"
                    bind:value={draft[entry.key]}
                    disabled={busy}
                  >
                    <option value="0">off (0)</option>
                    <option value="1">on (1)</option>
                  </select>
                {:else}
                  <input
                    type={inputType(entry)}
                    class="w-full max-w-full rounded border border-slate-200 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-950"
                    bind:value={draft[entry.key]}
                    disabled={busy}
                  />
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      {/if}
      {#if secretKeys.length > 0}
        <p class="mb-1 text-xs font-medium text-slate-700 dark:text-gray-300">Secrets (edit on host only)</p>
        <ul class="mb-3 max-h-32 overflow-y-auto text-xs text-slate-500 dark:text-gray-500">
          {#each secretKeys as entry (entry.key)}
            <li class="font-mono">{entry.key}</li>
          {/each}
        </ul>
      {/if}
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded bg-slate-800 px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900"
          disabled={busy}
          onclick={() => void saveDraft()}
        >
          Save (stage)
        </button>
        <button
          type="button"
          class="rounded border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-gray-600"
          disabled={busy}
          onclick={() => void applyStaged()}
        >
          Apply
        </button>
        <button
          type="button"
          class="rounded border border-red-300 px-3 py-1.5 text-xs text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-200"
          disabled={busy}
          onclick={() => void rollbackEnv()}
        >
          Rollback
        </button>
      </div>
      {#if statusMsg}
        <p class="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{statusMsg}</p>
      {/if}
      {#if errorMsg}
        <p class="mt-2 text-xs text-red-600 dark:text-red-400">{errorMsg}</p>
      {/if}
    </div>
  {/if}
</section>
