import type { Component } from "svelte";

import type { DataGateway } from "../dataGateway";
import type { DashboardTile } from "../dashboard/types";
import { applyPerfCompactAsPercentOnly } from "./tileDisplay";
import CpuTile from "./CpuTile.svelte";
import DhcpClientsTile from "./DhcpClientsTile.svelte";
import DhcpPoolsTile from "./DhcpPoolsTile.svelte";
import DhcpReservationsTile from "./DhcpReservationsTile.svelte";
import DiskTile from "./DiskTile.svelte";
import DiscoveryTile from "./DiscoveryTile.svelte";
import NwTile from "./NwTile.svelte";
import PerfTile from "./PerfTile.svelte";
import RamTile from "./RamTile.svelte";

/**
 * Runtime plugin registration (built-ins). See UI_ENGINE_SPEC §3.4 — full type will grow
 * (optionsSchema, settings fragment, gridPolicy hooks) in later Phase 2 items.
 */
export type PluginRegistration = {
  id: string;
};

export type TileHostContext = {
  gateway: DataGateway;
  tile: DashboardTile;
  liveCpuPercent?: number | null;
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

export class ManifestRegistry {
  /** Built-ins plus any `register()` calls (e.g. future dynamic plugins). */
  private readonly ids = new Set<string>(BUILTIN_IDS);

  register(_r: PluginRegistration): void {
    this.ids.add(_r.id);
  }

  get(id: string): PluginRegistration | undefined {
    return this.ids.has(id) ? { id } : undefined;
  }

  list(): PluginRegistration[] {
    return [...this.ids].sort().map((id) => ({ id }));
  }
}

export const manifestRegistry = new ManifestRegistry();

function dhcpPools(ctx: TileHostContext): ResolvedPluginMount {
  return { component: DhcpPoolsTile as Component<Record<string, unknown>>, props: { gateway: ctx.gateway, tile: ctx.tile } };
}

function dhcpClients(ctx: TileHostContext): ResolvedPluginMount {
  return { component: DhcpClientsTile as Component<Record<string, unknown>>, props: { gateway: ctx.gateway, tile: ctx.tile } };
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
    props: { gateway: ctx.gateway, tile: ctx.tile, liveCpuPercent: ctx.liveCpuPercent },
  };
}

function perfCpu(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: CpuTile as Component<Record<string, unknown>>,
    props: {
      gateway: ctx.gateway,
      tile: ctx.tile,
      liveCpuPercent: ctx.liveCpuPercent,
      onGridHint: ctx.onPerfTileGridHint
        ? (hint: { colSpan: number; rowSpan: number }) => ctx.onPerfTileGridHint!(ctx.tile.id, hint)
        : undefined,
    },
  };
}

function perfRam(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: RamTile as Component<Record<string, unknown>>,
    props: {
      gateway: ctx.gateway,
      tile: ctx.tile,
      onGridHint: ctx.onPerfTileGridHint
        ? (hint: { colSpan: number; rowSpan: number }) => ctx.onPerfTileGridHint!(ctx.tile.id, hint)
        : undefined,
    },
  };
}

function perfNw(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: NwTile as Component<Record<string, unknown>>,
    props: {
      gateway: ctx.gateway,
      tile: ctx.tile,
      onGridHint: ctx.onPerfTileGridHint
        ? (hint: { colSpan: number; rowSpan: number }) => ctx.onPerfTileGridHint!(ctx.tile.id, hint)
        : undefined,
    },
  };
}

function perfDisk(ctx: TileHostContext): ResolvedPluginMount {
  return {
    component: DiskTile as Component<Record<string, unknown>>,
    props: {
      gateway: ctx.gateway,
      tile: ctx.tile,
      onGridHint: ctx.onPerfTileGridHint
        ? (hint: { colSpan: number; rowSpan: number }) => ctx.onPerfTileGridHint!(ctx.tile.id, hint)
        : undefined,
    },
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

/** Resolve built-in tile component + props for `PluginTileMount.svelte`. */
export function resolvePluginTileMount(ctx: TileHostContext): ResolvedPluginMount | null {
  const tile = applyPerfCompactAsPercentOnly(ctx.tile);
  const fn = TILE_RESOLVERS[tile.pluginId];
  return fn ? fn({ ...ctx, tile }) : null;
}
