# `apps/ui/src/lib` layout

Module folders (2026-05 restructure). Import paths are relative from each file; there is no `$lib` alias.

| Path | Responsibility |
| --- | --- |
| `app/` | Operator bootstrap: `operatorBoot`, `appMount`, `appDashboardShell` |
| `gateway/` | `DataGateway` (Kea Fabric HTTP + SSE) |
| `version/` | `UI_VERSION` string for shell chrome |
| `api/` | OpenAPI Zod helpers and shared API types |
| `components/` | Reusable UI: `baseDataTable/`, `basePagination/`, `gauge/`, `editors/`, `metrics/`, `tablePlugin/`, `validation/` |
| `plugins/` | Built-in tiles: `core/` (registry), `dhcp/`, `discovery/`, `perf/`, `fixtures/` |
| `piholeCp/` | Pi-hole CP embed: `shell/`, `gateway/`, `layout/`, `perf/`, `env/`, `logs/`, `session/`, `plugins/`, `kea/`, `store/`, `meta/` |
| `dashboard/` | Layout engine, editor, placement, event bus |
| `palette/` | Plugin palette and drag helpers |
| `theme/` | Theme storage and controls |
| `admin/` | Admin routes and pages |
| `platform/` | Feature flags and extension registries |

Executable plan: [`docs/superpowers/plans/2026-05-17-ui-lib-folder-restructure.md`](../../../../docs/superpowers/plans/2026-05-17-ui-lib-folder-restructure.md).
