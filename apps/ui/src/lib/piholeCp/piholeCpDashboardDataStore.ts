import { writable } from "svelte/store";

import type { DashboardResponse } from "./dashboardZod";

/** Live `/dashboard` payload for `pihole_ha.section` tiles (read by plugin tile components). */
export const piholeCpDashboardData = writable<DashboardResponse | null>(null);
