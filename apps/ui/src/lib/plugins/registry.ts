import type { Component } from "svelte";

import type { DataGateway } from "../dataGateway";
import type { FabricEventBus } from "../dashboard/eventBus";
import type { DashboardTile } from "../dashboard/types";
import { applyPerfCompactAsPercentOnly } from "./tileDisplay";
import DhcpClientsTile from "./DhcpClientsTile.svelte";
import DhcpPoolsTile from "./DhcpPoolsTile.svelte";
import DhcpReservationsTile from "./DhcpReservationsTile.svelte";
import DiscoveryTile from "./DiscoveryTile.svelte";
import PerfMetricTile from "./PerfMetricTile.svelte";
import PerfTile from "./PerfTile.svelte";
import PerfTileSettingsForm from "./perf/PerfOptionsForm.svelte";

/**
 * Runtime plugin registration (built-ins). See `docs/planning/UI_ENGINE_SPEC.md` §3.4.
 */
export type PluginRegistration = {
  id: string;
};

export type TileHostContext = {
  gateway: DataGateway;
  bus: FabricEventBus;
  tile: DashboardTile;
  editLayout: boolean;
  onEditTile?: (t: DashboardTile) => void;
  onPerfTileGridHint?: (tileId: string, hint: { colSpan: number; rowSpan: number }) => void;
};

export type ResolvedPluginMount = {
  component: Component<Record<string, unknown>>;
  props: Record<string, unknown>;
};

const BUILTIN_IDS = [
  "dhcp.pools",
  "dhcp.clients",
  "dhcp.reservations",
  "discovery.records",
  "perf.summary",
  "perf.cpu",
  "perf.ram",
  "perf.network",
  "perf.disk",
] as const;

const TILE_SETTINGS_IDS = new Set<string>([
  "perf.summary",
  "perf.cpu",
  "perf.ram",
  "perf.network",
  "perf.disk",
]);

/** Tile settings body for `TileSettingsOverlay` (perf plugins only). */
export function resolvePluginTileSettings(
  pluginId: string,
): Component<{ draft: DashboardTile }> | null {
  if (!TILE_SETTINGS_IDS.has(pluginId)) return null;
  return PerfTileSettingsForm as Component<{ draft: DashboardTile }>;
}

export class ManifestRegistry {
  private readonly ids = new Set<string>(BUILTIN_IDS);

  register(_r: PluginRegistration): void {
    this.ids.add(_r.id);
  }

  unregister(id: string): void {
    this.ids.delete(id);
  }

  get(id: string): PluginRegistration | undefined {
    return this.ids.has(id) ? { id } : undefined;
  }

  list(): PluginRegistration[] {
    return [...this.ids].sort().map((id) => ({ id }));
  }
}

export const manifestRegistry = new ManifestRegistry();

function gridHint(
  ctx: TileHostContext,
): ((hint: { colSpan: number; rowSpan: number }) => void) | undefined {
  return ctx.onPerfTileGridHint
    ? (hint: { colSpan: number; rowSpan: number }) => ctx.onPerfTileGridHint!(ctx.tile.id, hint)
    : undefined;
}

function dhcpPools(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: DhcpPoolsTile as Component<Record<string, unknown>>,
    props: { gateway: ctx.gateway, tile: ctx.tile },
  };
}

function dhcpClients(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: DhcpClientsTile as Component<Record<string, unknown>>,
    props: { gateway: ctx.gateway, tile: ctx.tile },
  };
}

function dhcpReservations(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: DhcpReservationsTile as Component<Record<string, unknown>>,
    props: { gateway: ctx.gateway, tile: ctx.tile },
  };
}

function discovery(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: DiscoveryTile as Component<Record<string, unknown>>,
    props: {
      gateway: ctx.gateway,
      tile: ctx.tile,
      onOpenSettings:
        ctx.editLayout && ctx.onEditTile ? () => ctx.onEditTile?.(ctx.tile) : undefined,
    },
  };
}

function perfSummary(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: PerfTile as Component<Record<string, unknown>>,
    props: { gateway: ctx.gateway, tile: ctx.tile },
  };
}

function perfCpu(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: PerfMetricTile as Component<Record<string, unknown>>,
    props: { gateway: ctx.gateway, tile: ctx.tile, metric: "cpu", onGridHint: gridHint(ctx) },
  };
}

function perfRam(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: PerfMetricTile as Component<Record<string, unknown>>,
    props: { gateway: ctx.gateway, tile: ctx.tile, metric: "ram", onGridHint: gridHint(ctx) },
  };
}

function perfNw(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: PerfMetricTile as Component<Record<string, unknown>>,
    props: {
      gateway: ctx.gateway,
      tile: ctx.tile,
      metric: "network",
      onGridHint: gridHint(ctx),
    },
  };
}

function perfDisk(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: PerfMetricTile as Component<Record<string, unknown>>,
    props: { gateway: ctx.gateway, tile: ctx.tile, metric: "disk", onGridHint: gridHint(ctx) },
  };
}

const TILE_RESOLVERS: Record<string, (ctx: TileHostContext) => ResolvedPluginMount> = {
  "dhcp.pools": dhcpPools,
  "dhcp.clients": dhcpClients,
  "dhcp.reservations": dhcpReservations,
  "discovery.records": discovery,
  "perf.summary": perfSummary,
  "perf.cpu": perfCpu,
  "perf.ram": perfRam,
  "perf.network": perfNw,
  "perf.disk": perfDisk,
};

const dynamicResolvers: Record<string, (ctx: TileHostContext) => ResolvedPluginMount> = {};

type PrefixPluginResolver = {
  prefix: string;
  except: Set<string>;
  fn: (ctx: TileHostContext) => ResolvedPluginMount;
};

const prefixPluginResolvers: PrefixPluginResolver[] = [];

export function registerDynamicPluginResolver(
  id: string,
  resolver: (ctx: TileHostContext) => ResolvedPluginMount,
): () => void {
  dynamicResolvers[id] = resolver;
  manifestRegistry.register({ id });
  return () => {
    delete dynamicResolvers[id];
    manifestRegistry.unregister(id);
  };
}

/**
 * When `tile.pluginId` is not an exact built-in or dynamic id, match the first prefix entry
 * where `pluginId.startsWith(prefix)` and `pluginId` is not in `exceptIds`.
 */
export function registerDynamicPluginPrefixResolver(
  prefix: string,
  exceptIds: readonly string[],
  resolver: (ctx: TileHostContext) => ResolvedPluginMount,
): () => void {
  const except = new Set(exceptIds);
  const entry: PrefixPluginResolver = { prefix, except, fn: resolver };
  prefixPluginResolvers.push(entry);
  return () => {
    const i = prefixPluginResolvers.indexOf(entry);
    if (i >= 0) prefixPluginResolvers.splice(i, 1);
  };
}

export function resolvePluginTileMount(ctx: TileHostContext): ResolvedPluginMount | null {
  const tile = applyPerfCompactAsPercentOnly(ctx.tile);
  let fn: ((c: TileHostContext) => ResolvedPluginMount) | undefined =
    TILE_RESOLVERS[tile.pluginId] ?? dynamicResolvers[tile.pluginId];
  if (!fn) {
    for (const pr of prefixPluginResolvers) {
      if (tile.pluginId.startsWith(pr.prefix) && !pr.except.has(tile.pluginId)) {
        fn = pr.fn;
        break;
      }
    }
  }
  return fn ? fn({ ...ctx, tile }) : null;
}
