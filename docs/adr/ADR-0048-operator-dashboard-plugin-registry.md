---
title: "ADR-0048: Operator dashboard plugin registry and mount resolution"
adr: 0048
status: Accepted
date: 2026-04-23
owner: GriffinAD
peer_reviewer: GriffinAD
deciders: []
due_date: null
re_entry_criteria: null
touch_points: []
---

# ADR-0048: Operator dashboard plugin registry and mount resolution

> MADR format. Every ADR lives in `docs/adr/` and is referenced by the
> architecture docs whose design depends on it.

## Status

`Accepted`

## Context

The operator dashboard must resolve `pluginId` from saved layout and API
manifests to a concrete Svelte tile implementation without scattering literals
across `DashboardHost`, `gridPlacement`, and settings overlays. The UI engine
spec and blueprint call for a **ManifestRegistry** (or equivalent) at the
kernel/plugin-host boundary, with unknown and disabled plugins handled as typed
fallbacks (see ADR-0049).

## Decision drivers

- Adding a built-in plugin should not require edits across the whole dashboard
  host.
- Dynamic registration (tests, future marketplace) must not fork the resolve
  path used by production built-ins.
- Wire contract for `PluginEntry` / `ui_dashboard` stays in OpenAPI; runtime
  resolution stays in `apps/ui`.

## Considered options

1. **Switch on `pluginId` in `DashboardHost`** — simple today; does not scale;
  violates engine layering.
2. **Central registry + `resolvePluginTileMount`** — one map from id to component
  factory; optional `register` / `unregister` for non-built-in ids.
3. **Lazy dynamic `import()` per id** — smaller bundles; more async complexity
  for v1 built-ins.

## Decision outcome

Chosen option: **2 — `ManifestRegistry` + `resolvePluginTileMount`** in
`apps/ui/src/lib/plugins/registry.ts`, with built-in ids seeded at module load
and Vitest/E2E hooks for `registerDynamicPluginResolver` teardown. Layout Zod
and `PluginTileMount` consume the same id namespace; API `enabled: false` flows
through manifest resolution in the mount path per ADR-0049.

`PluginRegistration` in TypeScript remains minimal (`id` today); optional
`optionsSchema`, settings fragments, and `gridPolicy` can extend the type without
changing the resolve indirection.

### Positive consequences

- Dashboard host stays free of per-plugin `if` chains for mounting.
- Tests can simulate unknown and throwing plugins deterministically.

### Negative consequences

- Built-in list is still explicit in code until a codegen or manifest-driven
  loader exists.
- Registry and OpenAPI `PluginEntry.id` must stay aligned manually.

## Validation

Falsified if: (a) `DashboardHost` or `gridPlacement` gain new hard-coded
`pluginId ===` branches for mounting or (b) Vitest `registry.test.ts` and
Playwright dashboard tests no longer cover unknown/disabled/dynamic paths.

Guardrails: `npm run check:ui-plugin-guard` (allow-listed literals outside
`lib/plugins/`).

## Pros and cons of the options

### Option 1

- ✅ Fast to write initially.
- ❌ Engine boundary erodes; every new plugin touches host files.

### Option 2

- ✅ Single resolve choke point; aligns with blueprint and spec.
- ❌ Requires discipline to keep registration table updated.

### Option 3

- ✅ Potential bundle wins.
- ❌ Async mount and error boundaries are harder; unnecessary for current
  built-in set.

## Links

- Related ADRs: ADR-0049 (fault isolation + host controls), ADR-0046 (Flowbite
  shell).
- Related docs:
  [dashboard-plugin-blueprint.md](../architecture/dashboard-plugin-blueprint.md),
  [UI_ENGINE_SPEC.md](../planning/UI_ENGINE_SPEC.md) (planning — §3.4 / §5).
- Implementation: `apps/ui/src/lib/plugins/registry.ts`,
  `PluginTileMount.svelte`.

## Change Log

- 2026-04-23 — Accepted: central registry + mount resolution for operator
  dashboard (GriffinAD).
