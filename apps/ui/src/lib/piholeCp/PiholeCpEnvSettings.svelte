<script lang="ts">
  import type { EnvConfigResponse, EnvSchemaEntry } from "./envConfigZod";
  import { PiholeCpGateway } from "./PiholeCpGateway";
  import { readPiholeCpApiToken, writePiholeCpApiToken } from "./piholeCpApiToken";

  let {
    baseUrl,
    onApplied,
  }: {
    baseUrl: string;
    onApplied?: () => void;
  } = $props();

  let schemaKeys = $state<EnvSchemaEntry[]>([]);
  let config = $state<EnvConfigResponse | null>(null);
  let draft = $state<Record<string, string>>({});
  let apiTokenInput = $state(readPiholeCpApiToken());
  let statusMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);
  let busy = $state(false);
  let open = $state(false);

  async function loadConfig() {
    errorMsg = null;
    const gw = new PiholeCpGateway(baseUrl);
    const [schema, env] = await Promise.all([gw.getEnvSchema(), gw.getEnvConfig()]);
    schemaKeys = schema.keys;
    config = env;
    draft = { ...env.effective, ...(env.pending ?? {}) };
  }

  async function run(mutate: () => Promise<void>) {
    busy = true;
    errorMsg = null;
    statusMsg = null;
    try {
      writePiholeCpApiToken(apiTokenInput);
      await mutate();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function saveDraft() {
    const token = readPiholeCpApiToken();
    if (!token) {
      errorMsg = "API token required for mutations.";
      return;
    }
    const changes: Record<string, string> = {};
    for (const entry of schemaKeys) {
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
      statusMsg =
        res.status === 202
          ? "Changes staged. Apply runs the host script (or shows the command)."
          : "Changes staged.";
      await loadConfig();
    });
  }

  async function applyStaged() {
    const token = readPiholeCpApiToken();
    if (!token) {
      errorMsg = "API token required.";
      return;
    }
    await run(async () => {
      const gw = new PiholeCpGateway(baseUrl);
      const res = await gw.applyEnvConfig(token);
      statusMsg = res.example ? `${res.summary} Example: ${res.example}` : res.summary;
      await loadConfig();
      onApplied?.();
    });
  }

  async function rollbackEnv() {
    const token = readPiholeCpApiToken();
    if (!token) {
      errorMsg = "API token required.";
      return;
    }
    await run(async () => {
      const gw = new PiholeCpGateway(baseUrl);
      const res = await gw.rollbackEnvConfig(token);
      statusMsg = res.example ? `${res.summary} ${res.example}` : res.summary;
      await loadConfig();
      onApplied?.();
    });
  }

  $effect(() => {
    if (open && schemaKeys.length === 0) {
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

<section class="mb-4 rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
  {#if open}
    <div class="border-t border-slate-100 px-4 py-3 dark:border-gray-800">
      <p class="mb-3 text-xs text-slate-600 dark:text-gray-400">
        Tier-1 keys per ADR-0053. Save stages changes; Apply runs the host script (or shows the command).
      </p>
      <label class="mb-3 block text-xs">
        <span class="text-slate-500 dark:text-gray-500">API token</span>
        <input
          type="password"
          class="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-950"
          bind:value={apiTokenInput}
          autocomplete="off"
        />
      </label>
      {#if config?.pending}
        <p class="mb-2 text-xs text-amber-800 dark:text-amber-200">
          Pending staged patch: {Object.keys(config.pending).join(", ")}
        </p>
      {/if}
      {#if schemaKeys.length > 0}
        <dl class="mb-3 grid gap-2">
          {#each schemaKeys as entry (entry.key)}
            <div class="grid gap-1 text-xs sm:grid-cols-[1fr_8rem] sm:items-center">
              <dt class="text-slate-600 dark:text-gray-400">{entry.label}</dt>
              <dd>
                {#if entry.type === "boolean"}
                  <select
                    class="w-full rounded border border-slate-200 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-950"
                    bind:value={draft[entry.key]}
                  >
                    <option value="0">off (0)</option>
                    <option value="1">on (1)</option>
                  </select>
                {:else}
                  <input
                    type={inputType(entry)}
                    class="w-full rounded border border-slate-200 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-950"
                    bind:value={draft[entry.key]}
                  />
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
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