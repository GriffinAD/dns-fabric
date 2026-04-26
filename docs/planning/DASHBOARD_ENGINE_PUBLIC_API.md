# Dashboard engine — public API sketch

**Status:** planning artifact (Phase 10). No npm package export yet; this lists intended **stability** tiers for a future extract.

| Area | Path (under `apps/ui/src/lib`) | Tier |
| --- | --- | --- |
| Layout types | `dashboard/types.ts` | stable |
| Migration | `dashboard/migration/` | stable |
| Persistence facade | `dashboard/persistence/` | stable |
| Grid placement | `dashboard/gridPlacement.ts`, `dashboard/layoutTree.ts` | stable |
| Host view contract | `dashboard/DashboardHost.svelte` props | experimental |
| Kea adapters | `dataGateway.ts`, `api/types.ts` | internal (host-specific) |

Engine README rule: anything importing Kea `api/types` is **adapter** layer, not guaranteed portable without substitution.
