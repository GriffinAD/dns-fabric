import { readonly, writable, type Readable } from "svelte/store";

import { perfSummaryResponseSchema } from "../api/openapiZod";
import type { FabricEvent, PerfSummaryResponse } from "../api/types";
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

  return {
    subscribe,
    connect,
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
