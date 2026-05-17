/** Stable import path for plugins (`check:ui-plugin-dashboard-imports`). */
export {
  aggregateFabricConnectionStates,
  createFabricEventBus,
  dhcpClientsListUpdated,
  dhcpPoolsListUpdated,
  dhcpReservationsListUpdated,
  discoveryScanUpdated,
  FABRIC_EVENT_BUS,
  perfUpdatedCpuPercent,
  perfUpdatedFullSummary,
  type FabricConnectionState,
  type FabricEventBus,
  type FabricTransportHandle,
} from "./bus/eventBus";
