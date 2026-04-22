---
title: "<Tier A doc title>"
tier: A
gate: 1
owner: GriffinAD
peer_reviewer: GriffinAD
status: Proposed
last_review: YYYY-MM-DD
adrs: []
invariants: []
---

# <Tier A doc title>

> **Tier A** — foundational. Gate 1 deliverable. Every other doc may cite this.
> Changes here ripple: update all dependants in the same PR or open an ADR.

## Scope

What this document covers, and (as important) what it does **not** cover.
Link explicitly to the sibling docs that own any adjacent concerns.

## Invariants

Each invariant is a copy of the `INVARIANT_BLOCK_TEMPLATE.md` block. All IDs
must be unique across the repo and indexed in `docs/architecture/invariants.md`.

<!-- Example:

### INV-<AREA>-<NAME>

- **Statement:** …
- **Rationale:** …
- **Enforcement:** …
- **Test hook:** …
- **Back-links:** …

-->

## Contracts

Every machine-readable contract referenced here must live under `specs/` and
be linked by relative path. List them.

| Contract | Artefact | Notes |
|---|---|---|
| … | `specs/…` | … |

## Cross-refs

- Related ADRs: …
- Related docs: …
- Related specs: …

## Change Log

| Date | Status | Reviewer | Notes |
|---|---|---|---|
| YYYY-MM-DD | Proposed | TBD | Initial draft. |
