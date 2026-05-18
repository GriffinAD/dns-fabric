<script lang="ts">
  import type { PluginEntry } from "../../api/types";
  import type { DashboardGroup } from "../types";
  import VerticalStackGroupHost from "./VerticalStackGroupHost.svelte";

  let {
    group: initialGroup,
    editLayout = false,
    onGroupChange,
    plugins = [] as PluginEntry[],
  }: {
    group: DashboardGroup;
    editLayout?: boolean;
    onGroupChange?: (g: DashboardGroup) => void;
    plugins?: PluginEntry[];
  } = $props();

  let group = $state(initialGroup);

  $effect(() => {
    group = initialGroup;
  });

  function handleGroupChange(next: DashboardGroup) {
    group = next;
    onGroupChange?.(next);
  }
</script>

<VerticalStackGroupHost {group} {editLayout} onGroupChange={handleGroupChange} {plugins}>
  {#snippet tileContent(tile)}
    <div data-tile-body={tile.id}>{tile.pluginId}</div>
  {/snippet}
</VerticalStackGroupHost>
