---
title: "ADR-0054: Dashboard tab containers as group host controls"
adr: 0054
status: Accepted
date: 2026-05-17
owner: GriffinAD
peer_reviewer: GriffinAD
deciders: []
due_date: null
re_entry_criteria: null
touch_points:
  - docs/adr/ADR-0049-operator-dashboard-fault-isolation-host-controls-v1.md
  - specs/dashboard/layout.schema.json
  - apps/ui/src/lib/dashboard/types.ts
  - apps/ui/src/lib/dashboard/layoutZod.ts
  - apps/ui/src/lib/dashboard/migration/layoutUpgrade.ts
---

# ADR-0054: Dashboard tab containers as group host controls

> MADR format. Every ADR lives in `docs/adr/` and is referenced by the
> architecture docs whose design depends on it.

## Status

`Accepted`

## Context

Operators need tabbed regions on the dashboard: multiple plugin surfaces (or nested
containers) behind renameable tabs, with editor support for add, move, delete, and
reorder. [ADR-0049](ADR-0049-operator-dashboard-fault-isolation-host-controls-v1.md)
allowed `hostControl: "tab-control"` on **tiles** but implemented only a placeholder
(`TileFallback` with `host-control-not-implemented`). That kept layout JSON honest
without implying a single tile could host multiple plugins.

Product decision **D1** (2026-05-17): tabs are **group children**, not a tile-level
host surface.

## Decision drivers

- One tab = one layout node (tile or nested group), not an implicit slot inside a plugin.
- Nested tab groups (tabs within a tab) must be representable in v3 layout JSON.
- Saved layouts with legacy tile `tab-control` must upgrade without data loss.
- Validation must align across JSON Schema, Zod, and API (`layout_validate.py` tolerates optional fields).

## Considered options

1. **Tile-level `tab-control` with `hostSlots[]`** — extend the tile model with child slots.
2. **`DashboardGroup` with `hostControl: "tab-control"`** — each `children[]` entry is a tab (tile or nested group).
3. **Separate `kind: "tab-container"`** — new root item type parallel to `group`.

## Decision outcome

Chosen option: **2**, because it reuses the v3 nested-group graph, matches the UI engine
group chrome model, and avoids a third layout node kind.

### Wire model

- **Tab container:** `DashboardGroup` with `hostControl: "tab-control"` (default group
  chrome is `hostControl` omitted or `"panel"`).
- **Tab strip labels:** optional `tabLabel` on each child (`DashboardTile` or nested
  `DashboardGroup`). When omitted, UI and migration default to the child `id`.
- **Active tab:** `hostState.activeChildId` references a child `id`; when omitted, the
  first child is active.
- **Nested tab groups:** a child group may also set `hostControl: "tab-control"`.
- **Legacy tile `hostControl: "tab-control"`:** deprecated; `ensureLayoutV3` wraps the
  tile in a tab group (see `migrateLegacyTabControlTiles` in `layoutUpgrade.ts`).

### Validation rules

| Rule | Rationale |
| --- | --- |
| `hostControl: "tab-control"` ⇒ `innerWrap` must not be `true` | Tabs show one pane; no wrap grid. |
| Tab group `children.length` ∈ [1, 12] | Strip UX and performance bound. |
| Child `id` values unique within the tab group | Stable keys and `activeChildId`. |
| `hostState.activeChildId` must match a child `id` when set | Avoid empty selection. |
| Tile-level `tab-control` still parses | Migration path for stored layouts. |

### Amendment to ADR-0049

- **Tile-level `tab-control`:** legacy only; new layouts should use group tab containers.
  Placeholder fallback remains until H2 (`TabGroupHost`) ships; migrated layouts no longer
  rely on tile-level tab-control at runtime after upgrade.
- **Group-level `tab-control`:** in scope for H0–H4; `vertical-stack` / `split-grid` on
  groups remain placeholders per ADR-0049 until a follow-up ADR.

### Positive consequences

- One graph model for panels, nowrap strips, and tab containers.
- Nested DHCP-within-CPU-style layouts are explicit in JSON.
- Import/export and CP layout sync share the same schema fields.

### Negative consequences

- Migration changes root `id` for legacy tab tiles (wrapper group id `tab-group-{tileId}`).
- H2–H4 must implement editor/read hosts before operators see real tabs.

## Validation

- `layoutZod.test.ts` accepts a tab-control group with tile and nested tab-group children.
- `layoutUpgrade.test.ts` wraps legacy tile `tab-control` into a group with `single-panel` child.
- `bash scripts/validate_specs.sh` passes after `layout.schema.json` update.
- Falsified if tab groups require tile-level `hostSlots` or break v3 depth/id rules.

## Pros and cons of the options

### Option 1 (tile slots)

- ✅ Keeps root item count stable.
- ❌ Duplicates group semantics; plugins do not own tab children.

### Option 2 (group host control)

- ✅ Reuses v3 nesting; clear editor ownership.
- ❌ Requires migration for legacy tile tab-control.

### Option 3 (new kind)

- ✅ Explicit type tag.
- ❌ Extra migration and parity surface without benefit over option 2.

## Links

- Related ADRs: [ADR-0049](ADR-0049-operator-dashboard-fault-isolation-host-controls-v1.md), [ADR-0050](ADR-0050-layout-schema-parity-matrix.md).
- Plan: [`docs/superpowers/plans/2026-05-17-ui-refactor-separation-of-concerns.md`](../superpowers/plans/2026-05-17-ui-refactor-separation-of-concerns.md) (H0–H4).
- Schema: `specs/dashboard/layout.schema.json`.
- Implementation: `apps/ui/src/lib/dashboard/types.ts`, `layoutZod.ts`, `migration/layoutUpgrade.ts`.

## Change Log

- 2026-05-17 — Accepted: tab containers as `DashboardGroup` host controls (GriffinAD).
