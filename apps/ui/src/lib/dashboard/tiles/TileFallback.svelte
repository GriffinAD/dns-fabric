<script lang="ts">
  import Button from "flowbite-svelte/Button.svelte";
  import Card from "flowbite-svelte/Card.svelte";

  export type TileFallbackReason = "unknown" | "disabled" | "error" | "host-control-not-implemented";

  let {
    reason,
    pluginId = undefined,
    details = undefined,
    hostControl = undefined,
    onRetry = undefined,
  }: {
    reason: TileFallbackReason;
    pluginId?: string;
    details?: string;
    hostControl?: string;
    onRetry?: () => void;
  } = $props();

  let showDetails = $state(false);
  const isDev = import.meta.env.DEV;

  const title = $derived.by(() => {
    switch (reason) {
      case "unknown":
        return "Unknown plugin";
      case "disabled":
        return "Plugin disabled";
      case "error":
        return "Tile error";
      case "host-control-not-implemented":
        return "Host control not available";
      default:
        return "Tile unavailable";
    }
  });

  const body = $derived.by(() => {
    switch (reason) {
      case "unknown":
        return "This tile references a plugin that is not installed or recognized.";
      case "disabled":
        return "This plugin is turned off for this deployment.";
      case "error":
        return "Something went wrong while rendering this tile.";
      case "host-control-not-implemented":
        return `The “${hostControl ?? "requested"}” host control is not implemented in this version. Use single-panel or edit the tile after a future upgrade.`;
      default:
        return "";
    }
  });
</script>

<Card
  size="xl"
  class="box-border !max-w-full w-full min-w-0 flex-1 min-h-0 flex-col border-amber-200/80 dark:border-amber-900/50"
  data-testid="tile-fallback"
  data-fallback-reason={reason}
>
  {#snippet children()}
    <div class="p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      {#if pluginId}
        <p class="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{pluginId}</p>
      {/if}
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{body}</p>
      {#if reason === "disabled"}
        <p class="mt-3 text-sm">
          <a
            href="#/admin"
            class="font-medium text-primary-600 hover:underline dark:text-primary-400"
            data-testid="tile-fallback-admin-link"
          >
            Enable in Admin → Plugins
          </a>
        </p>
      {/if}
      {#if reason === "error" && details}
        {#if isDev}
          <pre
            class="mt-3 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200"
            data-testid="tile-fallback-details"
          >{details}</pre>
        {:else}
          <div class="mt-3">
            <Button type="button" color="alternative" size="xs" onclick={() => (showDetails = !showDetails)}>
              {showDetails ? "Hide details" : "Show details"}
            </Button>
            {#if showDetails}
              <pre
                class="mt-2 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                data-testid="tile-fallback-details"
              >{details}</pre>
            {/if}
          </div>
        {/if}
        {#if onRetry}
          <Button type="button" class="mt-3" size="xs" onclick={() => onRetry()}>Try again</Button>
        {/if}
      {/if}
    </div>
  {/snippet}
</Card>
