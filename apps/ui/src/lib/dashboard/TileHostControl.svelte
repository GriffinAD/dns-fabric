<script lang="ts">
  import type { Snippet } from "svelte";

  import type { HostControl } from "../api/types";
  import SinglePanelHost from "./hosts/SinglePanelHost.svelte";
  import TileFallback from "./TileFallback.svelte";

  let {
    hostControl,
    pluginId,
    children,
  }: {
    hostControl: HostControl;
    pluginId: string;
    children: Snippet;
  } = $props();
</script>

{#if hostControl === "single-panel"}
  <SinglePanelHost>{@render children()}</SinglePanelHost>
{:else}
  <TileFallback reason="host-control-not-implemented" {pluginId} hostControl={hostControl} />
{/if}
