<script lang="ts">
  import type { FabricEventBus } from "../dashboard/eventBus";
  import { usePluginBusSubscription } from "./pluginDataBus";

  let { bus }: { bus: FabricEventBus } = $props();

  usePluginBusSubscription(
    bus,
    "fabric.perf.updated",
    (p) => (typeof p === "number" ? p : null),
    async () => 0,
    () => {},
  );
</script>

<div data-testid="plugin-bus-use-probe">ok</div>
