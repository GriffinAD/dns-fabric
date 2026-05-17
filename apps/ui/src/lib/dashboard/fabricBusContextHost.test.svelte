<script lang="ts">
  import { setContext } from "svelte";

  import { requireFabricEventBusContext } from "./fabricBusKernel";
  import { FABRIC_EVENT_BUS, type FabricEventBus } from "./eventBus";

  let { bus }: { bus: FabricEventBus } = $props();

  setContext(FABRIC_EVENT_BUS, bus);
  const resolved = requireFabricEventBusContext();
</script>

<div data-testid="fabric-bus-context-ok" data-same={resolved === bus ? "yes" : "no"}></div>
