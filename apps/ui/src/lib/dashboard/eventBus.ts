import { readonly, writable, type Readable } from "svelte/store";

import {
  dhcpClientListResponseSchema,
  dhcpPoolListResponseSchema,
  dhcpReservationListResponseSchema,
  discoveryScanResponseSchema,
  perfSummaryResponseSchema,
} from "../api/openapiZod";
import type {
  DhcpClient,
  DhcpPool,
  DhcpReservation,
  DiscoveryScanResponse,
  FabricEvent,
  PerfSummaryResponse,
} from "../api/types";
import { DataGateway } from "../dataGateway";

/** Svelte context key for the fabric SSE fan-out bus (`docs/planning/UI_ENGINE_PLAN.md` P5). */
export const FABRIC_EVENT_BUS = Symbol("FABRIC_EVENT_BUS");

export type FabricConnectionState = "idle" | "connecting" | "open" | "error";

type TopicListener<T = unknown> = {
  selector: (payload: unknown) => T | null;
  onValue: (v: T) => void;
};

export type FabricEventBus = {
  subscribe<T>(
    topic: string,
    selector: (payload: unknown) => T | null,
    onValue: (v: T) => void,
  ): () => void;
  /** Attach single `EventSource` and dispatch to subscribers. Idempotent per instance. */
  connect(): () => void;
  /** Push a topic to subscribers (e.g. control-plane perf polling on Pi-hole CP). */
  emit(topic: string, payload: unknown): void;
  connectionState: Readable<FabricConnectionState>;
};

export function createFabricEventBus(gateway: DataGateway): FabricEventBus {
  const connectionState = writable<FabricConnectionState>("idle");
  const byTopic = new Map<string, Set<TopicListener>>();

  let releaseConnection: (() => void) | null = null;

  function subscribe<T>(
    topic: string,
    selector: (payload: unknown) => T | null,
    onValue: (v: T) => void,
  ): () => void {
    const listener: TopicListener<T> = { selector, onValue };
    let set = byTopic.get(topic);
    if (!set) {
      set = new Set();
      byTopic.set(topic, set);
    }
    set.add(listener as TopicListener);
    return () => {
      set!.delete(listener as TopicListener);
      if (set!.size === 0) byTopic.delete(topic);
    };
  }

  function dispatch(ev: FabricEvent): void {
    const set = byTopic.get(ev.topic);
    if (!set) return;
    for (const L of set) {
      const v = L.selector(ev.payload);
      if (v != null) L.onValue(v);
    }
  }

  function connect(): () => void {
    if (releaseConnection) return releaseConnection;
    connectionState.set("connecting");
    const unsubGateway = gateway.subscribeFabricEvents(
      (ev) => {
        connectionState.set("open");
        dispatch(ev);
      },
      () => {
        connectionState.set("error");
      },
    );
    releaseConnection = () => {
      unsubGateway();
      releaseConnection = null;
      connectionState.set("idle");
    };
    return releaseConnection;
  }

  function emit(topic: string, payload: unknown): void {
    dispatch({ topic, payload });
  }

  return {
    subscribe,
    connect,
    emit,
    connectionState: readonly(connectionState),
  };
}

/** Pick `cpu_percent_total` from `fabric.perf.updated` payloads. */
export function perfUpdatedCpuPercent(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>).cpu_percent_total;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Full perf snapshot from SSE (mock adds `tick`; stripped before Zod). */
export function perfUpdatedFullSummary(payload: unknown): PerfSummaryResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const p = { ...(payload as Record<string, unknown>) };
  delete p.tick;
  const parsed = perfSummaryResponseSchema.safeParse(p);
  return parsed.success ? parsed.data : null;
}

/** `fabric.discovery.scan.updated` scan snapshot. */
export function discoveryScanUpdated(payload: unknown): DiscoveryScanResponse | null {
  const parsed = discoveryScanResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** `fabric.dhcp.pools.updated` list payload (or revision signal handled by refetch helper). */
export function dhcpPoolsListUpdated(payload: unknown): DhcpPool[] | null {
  const parsed = dhcpPoolListResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.items : null;
}

/** `fabric.dhcp.clients.updated` list payload. */
export function dhcpClientsListUpdated(payload: unknown): DhcpClient[] | null {
  const parsed = dhcpClientListResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.items : null;
}

/** `fabric.dhcp.reservations.updated` list payload. */
export function dhcpReservationsListUpdated(payload: unknown): DhcpReservation[] | null {
  const parsed = dhcpReservationListResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.items : null;
}
