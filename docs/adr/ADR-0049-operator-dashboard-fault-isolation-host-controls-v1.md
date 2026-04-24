---
title: "ADR-0049: Operator dashboard fault isolation and host control scope for v1"
adr: 0049
status: Accepted
date: 2026-04-23
owner: GriffinAD
peer_reviewer: GriffinAD
deciders: []
due_date: null
re_entry_criteria: null
touch_points: []
---

# ADR-0049: Operator dashboard fault isolation and host control scope for v1

> MADR format. Every ADR lives in `docs/adr/` and is referenced by the
> architecture docs whose design depends on it.

## Status

`Accepted`

## Context

The operator dashboard mounts one Svelte component per layout tile. Plugins can throw during render, reference unknown ids, be disabled in the API, or request host controls the shell does not implement yet. Without isolation, one bad tile breaks the whole grid. The UI engine spec (§3.5, §4.3) and the dashboard plugin blueprint require per-tile fault isolation and honest behavior for `hostControl` values.

## Decision drivers

- Surrounding tiles must keep working when one tile fails.
- Storage and API may reference plugins that are missing, disabled, or newer than the client.
- Declaring `tab-control` / `vertical-stack` / `split-grid` in layout data must not silently behave like `single-panel`.
- v1 delivery must not block on full multi-tile host chrome (tabs, stacks, splits).

## Considered options

1. **Global error handler only** — one top-level catch; no per-tile recovery.
2. **Per-tile boundary + explicit placeholders** — `<svelte:boundary>` (or equivalent) around each mount, typed fallbacks for unknown/disabled/error/unimplemented host.
3. **Iframe per tile** — strong isolation; heavy operational cost for v1.

## Decision outcome

Chosen option: **2**, because it matches the blueprint, uses Svelte 5 `<svelte:boundary>` for render/effect errors, and keeps the data contract truthful.

- **`single-panel`:** implemented as a pass-through `SinglePanelHost` wrapper.
- **`tab-control`, `vertical-stack`, `split-grid`:** no v1 chrome; show `TileFallback` with `reason="host-control-not-implemented"` and the requested control name so operators are not misled.
- **Unknown `pluginId`:** `TileFallback` `reason="unknown"`.
- **`manifest.enabled === false`:** `TileFallback` `reason="disabled"` with recovery link to Admin.
- **`displayMode`:** DHCP pools/reservations/discovery ship a compact summary row; `perf.*` compact maps to `display_style: "percent_only"` in `applyPerfCompactAsPercentOnly` (see `tileDisplay.ts`).

### Positive consequences

- Failures are contained without bespoke try/catch in every plugin.
- Layout JSON that requests unimplemented hosts surfaces clearly in the UI.

### Negative consequences

- Error boundaries do not catch async errors inside event handlers or delayed timers; plugins must still handle their own async failures inside the tile.
- Placeholder host controls are visible until a future phase implements real chrome.

## Validation

- Unit tests cover `applyPerfCompactAsPercentOnly` and existing layout/registry paths.
- Manual check: a tile that throws in render shows fallback; siblings still render.
- If we add real `TabControlHost`, this ADR should be amended or superseded with the new scope.

## Pros and cons of the options

### Option 1

- ✅ Minimal code.
- ❌ One failure takes down the dashboard; violates blueprint.

### Option 2

- ✅ Isolation + clear operator messaging.
- ❌ Some duplication of fallback UI; must keep messages in sync with Admin flows.

### Option 3

- ✅ Maximum isolation.
- ❌ IPC, styling, and performance cost inappropriate for built-in tiles in v1.

## Links

- Related ADRs: ADR-0046 (Flowbite shell), ADR-0047 (charts/plugins).
- Related docs: [dashboard-plugin-blueprint.md](../architecture/dashboard-plugin-blueprint.md), [UI_ENGINE_SPEC.md](../planning/UI_ENGINE_SPEC.md).
- Implementation: `apps/ui/src/lib/dashboard/TileErrorBoundary.svelte`, `TileFallback.svelte`, `TileHostControl.svelte`, `hosts/SinglePanelHost.svelte`.

## Change Log

- 2026-04-23 — Accepted: fault isolation + v1 host control scope (GriffinAD).
