import { onDestroy } from "svelte";

import type { FabricEventBus } from "../dashboard/eventBus";

export function requireFabricBus(bus: FabricEventBus | undefined): FabricEventBus {
  if (!bus) throw new Error("FabricEventBus is required (dashboard kernel)");
  return bus;
}

/** One-shot bootstrap GET, then topic-driven updates. No setInterval. */
export function subscribeWithInitialFetch<T>(opts: {
  bus: FabricEventBus;
  topic: string;
  selector: (payload: unknown) => T | null;
  fetch: () => Promise<T>;
  onValue: (v: T) => void;
}): () => void {
  let alive = true;
  void opts.fetch().then(
    (v) => {
      if (alive) opts.onValue(v);
    },
    () => {
      /* tile fetch paths set local error state; avoid unhandled rejections */
    },
  );
  const off = opts.bus.subscribe(opts.topic, opts.selector, (v) => {
    if (alive) opts.onValue(v);
  });
  return () => {
    alive = false;
    off();
  };
}

/** Svelte 5 rune-friendly helper for tiles. */
export function usePluginBusSubscription<T>(
  bus: FabricEventBus,
  topic: string,
  selector: (payload: unknown) => T | null,
  fetch: () => Promise<T>,
  apply: (v: T) => void,
): void {
  const release = subscribeWithInitialFetch({ bus, topic, selector, fetch, onValue: apply });
  onDestroy(release);
}

type ListBusMessage<TItem> = { kind: "items"; items: TItem[] } | { kind: "refetch" };

/**
 * Bootstrap list GET, then apply inline list payloads or refetch on revision-only SSE signals.
 */
export function subscribeListWithInitialFetch<TItem>(opts: {
  bus: FabricEventBus;
  topic: string;
  fetch: () => Promise<{ items: TItem[] }>;
  parseItems: (payload: unknown) => TItem[] | null;
  onItems: (items: TItem[]) => void;
}): () => void {
  let alive = true;
  const load = () => {
    void opts.fetch().then(
      (r) => {
        if (alive) opts.onItems(r.items);
      },
      () => {
        /* list tiles set error state in manual reload paths */
      },
    );
  };
  load();
  const off = opts.bus.subscribe(
    opts.topic,
    (payload): ListBusMessage<TItem> | null => {
      const items = opts.parseItems(payload);
      if (items) return { kind: "items", items };
      if (payload != null && typeof payload === "object") return { kind: "refetch" };
      return null;
    },
    (msg) => {
      if (msg.kind === "refetch") load();
      else opts.onItems(msg.items);
    },
  );
  return () => {
    alive = false;
    off();
  };
}
