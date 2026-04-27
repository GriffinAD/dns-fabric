# ADR-0050: Layout schema parity via shared fixture matrix

- Status: Accepted
- Date: 2026-04-27

## Context

Dashboard layout validation happens in multiple layers:

- Python API validator (`src/kea_fabric/api/layout_validate.py`)
- UI Zod validator (`apps/ui/src/lib/dashboard/layoutZod.ts`)
- JSON schema artifacts (`specs/dashboard/layout.schema.json`)

Without a shared fixture matrix, drift can slip through during independent refactors.

## Decision

Adopt a **test-led parity** approach:

1. Shared fixtures under `specs/dashboard/parity/` with naming convention:
   - `layout.valid.*.json`
   - `layout.invalid.*.json`
2. Enforce Python parity in CI via `scripts/check_layout_parity.py`.
3. Enforce UI Zod parity through `apps/ui/src/lib/dashboard/layoutParity.spec.ts`.

This keeps validator intent aligned while preserving local implementation freedom.

## Consequences

- Adding or changing layout rules now requires fixture updates in one shared directory.
- CI fails if Python and fixture expectations diverge.
- UI unit tests fail if Zod and fixture expectations diverge.
- JSON schema drift remains guarded by existing spec validation and OpenAPI drift checks.
