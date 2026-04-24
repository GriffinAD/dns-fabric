import type { DhcpClient, DhcpPool, DhcpReservation, DiscoveryRecord } from "../lib/api/types";

import {
  MOCK_DISCOVERY_RECORD_COUNT,
  MOCK_POOL_RANGE_END,
  MOCK_POOL_RANGE_START,
  MOCK_SUBNET_CIDR,
  MOCK_T0_ISO,
} from "./mockConstants";

const POOL_ID = "pool-default";
const T0_MS = Date.parse(MOCK_T0_ISO);

function isoPlusSeconds(sec: number): string {
  return new Date(T0_MS + sec * 1000).toISOString();
}

/** Deterministic PRNG (Python stub uses the same LCG). */
export function mockRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 0x7f4a7c15) + 1) >>> 0;
    return s / 4294967296;
  };
}

function macForIndex(prefix: string, i: number): string {
  const b3 = (i >> 16) & 0xff;
  const b4 = (i >> 8) & 0xff;
  const b5 = i & 0xff;
  return `${prefix}:${b3.toString(16).padStart(2, "0")}:${b4.toString(16).padStart(2, "0")}:${b5.toString(16).padStart(2, "0")}`;
}

function shuffleInPlace<T>(arr: T[], rnd: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Active leases only (pool range). Static assignments belong in reservations, not this list. */
function buildDhcpClientItemsUncached(): DhcpClient[] {
  const out: DhcpClient[] = [];

  const poolHosts: number[] = [];
  for (let h = 100; h <= 254; h++) poolHosts.push(h);
  shuffleInPlace(poolHosts, mockRng(42_001));
  const chosen = poolHosts.slice(0, 100);

  for (let j = 0; j < 100; j++) {
    const lastOctet = chosen[j]!;
    const leaseStartSec = -1800 * (j + 1) - 50_000;
    out.push({
      id: `cli-dyn-${j + 1}`,
      hardware_address: macForIndex("52:54:01", 0x2000 + j),
      assigned_address: `192.168.2.${lastOctet}`,
      pool_id: POOL_ID,
      hostname: `lease-${j + 1}`,
      client_category: "workstation",
      vendor_name: "MockVendor",
      scan_status: "seen",
      lease_started_at: isoPlusSeconds(leaseStartSec),
      lease_expires_at: isoPlusSeconds(leaseStartSec + 86400 * (2 + (j % 4))),
      subnet_cidr: MOCK_SUBNET_CIDR,
      services: ["dhcp"],
    });
  }

  return out;
}

let _cachedClients: DhcpClient[] | null = null;

export function buildDhcpClientItems(): DhcpClient[] {
  if (!_cachedClients) _cachedClients = buildDhcpClientItemsUncached();
  return _cachedClients;
}

/** Static/reserved hosts 192.168.2.2 – .79 (outside the dynamic pool .100–.254). */
export function buildDhcpReservationItems(): DhcpReservation[] {
  const out: DhcpReservation[] = [];
  for (let i = 0; i < 78; i++) {
    const lastOctet = 2 + i;
    out.push({
      id: `res-${i + 1}`,
      hardware_address: macForIndex("52:54:02", 0x3000 + i),
      reserved_address: `192.168.2.${lastOctet}`,
      hostname: `reserved-${i + 1}`,
      category: "STATIC",
      subnet_cidr: MOCK_SUBNET_CIDR,
      vendor_name: "LAB",
      scan_status: "seen",
      services: ["dhcp"],
    });
  }
  return out;
}

export function buildDiscoveryRecordItems(): DiscoveryRecord[] {
  const clients = buildDhcpClientItems();
  const out: DiscoveryRecord[] = [];
  for (let i = 0; i < MOCK_DISCOVERY_RECORD_COUNT; i++) {
    const c = clients[i % clients.length]!;
    const addr = c.assigned_address;
    const lastSeenSec = -(i + 1) * 120;
    const state = i % 17 === 0 ? "stale" : i % 41 === 0 ? "lost" : "active";
    out.push({
      id: `disc-${i + 1}`,
      last_seen_at: isoPlusSeconds(lastSeenSec),
      state,
      addresses: [addr],
      labels: { vendor: i % 2 === 0 ? "lab" : "mock", role: `row-${i + 1}` },
    });
  }
  return out;
}

export function buildDefaultPool(): DhcpPool {
  return {
    id: POOL_ID,
    subnet_cidr: MOCK_SUBNET_CIDR,
    range_start: MOCK_POOL_RANGE_START,
    range_end: MOCK_POOL_RANGE_END,
    dns_domain: "example.test",
  };
}
