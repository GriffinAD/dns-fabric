# Plugin authoring — dashboard tiles

**Status:** planning note for the `plugin` branch (Phase 9).

## Allowed imports

- **Do:** import `../platform/extensions/dashboardTileRegistry` (or the public API in `DASHBOARD_ENGINE_PUBLIC_API.md`) to resolve presentation; use `DataGateway` for HTTP; colocate tile UI under `apps/ui/src/lib/plugins/<name>/`.
- **Do not:** import `layoutStore`, `gridPlacement`, or `DashboardHost` from plugin tiles — keep tiles as guests of the host.

## Registration

Built-ins stay registered in `apps/ui/src/lib/plugins/registry.ts`; the host should prefer `dashboardTileRegistry` exports so a future split can move implementation without changing tile imports.

## Shared behaviour

Prefer small composable helpers and presentational wrappers over deep class hierarchies. Shared props typing belongs next to the registry contract, not inside individual tile folders.
