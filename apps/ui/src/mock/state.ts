import type { DashboardLayout } from "../lib/dashboard/types";

import { MOCK_DISCOVERY_RECORD_COUNT } from "./mockConstants";

export interface DiscoveryScanState {
  state: "idle" | "running" | "paused" | "failed";
  updated_at: string;
  record_count: number | null;
}

let discoveryScan: DiscoveryScanState = {
  state: "running",
  updated_at: "2026-04-22T10:00:00Z",
  record_count: MOCK_DISCOVERY_RECORD_COUNT,
};

let savedLayout: DashboardLayout | null = null;

/** Live mock for perf SSE — bumped periodically in dev. */
let perfTick = 0;

/** Current perf tick (last value after `nextPerfTick`; 0 before first SSE increment). */
export function getPerfTick(): number {
  return perfTick;
}

export function getDiscoveryScan(): DiscoveryScanState {
  return { ...discoveryScan };
}

export function setDiscoveryPaused(paused: boolean): DiscoveryScanState {
  discoveryScan = {
    ...discoveryScan,
    state: paused ? "paused" : "running",
    updated_at: new Date().toISOString(),
    record_count: discoveryScan.record_count,
  };
  return getDiscoveryScan();
}

export function getSavedLayout(): DashboardLayout | null {
  return savedLayout;
}

export function setSavedLayout(layout: DashboardLayout): void {
  savedLayout = layout;
}

export function nextPerfTick(): number {
  perfTick += 1;
  return perfTick;
}
