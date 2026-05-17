import type { Component } from "svelte";

import type { DataGateway } from "../gateway/dataGateway";
import AdminLogsPage from "./AdminLogsPage.svelte";
import AdminRegistrySamplePage from "./AdminRegistrySamplePage.svelte";

export type AdminPageProps = { gateway: DataGateway };

/** Registered admin subpaths (under <code>#/admin/</code>). */
export const adminRouteRegistry: Record<string, Component<AdminPageProps>> = {
  logs: AdminLogsPage,
  "ext/sample": AdminRegistrySamplePage,
};

export function resolveAdminRoute(subpath: string): Component<AdminPageProps> | null {
  return adminRouteRegistry[subpath] ?? null;
}
