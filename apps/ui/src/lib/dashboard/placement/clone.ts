/**
 * Deep clone layout graph JSON. Prefer this over `structuredClone` for dashboard data: Svelte
 * `$state` proxies and other non-cloneable snapshots throw `DataCloneError` with `structuredClone`.
 */
export function cloneLayoutJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
