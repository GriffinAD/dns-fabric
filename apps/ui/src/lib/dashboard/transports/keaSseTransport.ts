import type { DataGateway } from "../../gateway/dataGateway";
import type { FabricEventBus } from "../eventBus";

/**
 * Kea fabric SSE (`/api/v1/events/stream`) is attached when `FabricEventBus.connect()`
 * runs on a gateway with a resolved API base. `attachFabricBusKernel` always calls
 * `connect()` on the kernel bus; Pi-hole CP may call `connect()` again when
 * `meta.kea_fabric_api_base_url` is set (see `PiholeOperatorApp.syncFabricSseAfterKeaBaseChange`).
 *
 * No separate attach function is required for the operator dashboard — this module
 * documents the Kea transport boundary for the fabric bus stack.
 */
export function attachKeaSseTransport(_bus: FabricEventBus, _gateway: DataGateway): () => void {
  return () => {};
}
