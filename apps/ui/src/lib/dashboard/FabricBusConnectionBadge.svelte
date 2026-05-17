<script lang="ts">
  import { get } from "svelte/store";

  import { fabricConnectionDotClass, fabricConnectionLabel } from "./fabricBusConnection";
  import type { FabricEventBus } from "./eventBus";

  let { bus }: { bus: FabricEventBus } = $props();

  const connectionState = $derived.by(() => get(bus.connectionState));
  const label = $derived(fabricConnectionLabel(connectionState));
  const dotClass = $derived(fabricConnectionDotClass(connectionState));
</script>

<span
  class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-gray-400"
  data-testid="fabric-bus-connection"
  data-connection-state={connectionState}
  title="Fabric event bus — aggregated transport status"
>
  <span class="h-2 w-2 shrink-0 rounded-full {dotClass}" aria-hidden="true"></span>
  {label}
</span>
