---
title: "<Tier B doc title>"
tier: B
gate: 1  # or 2
owner: GriffinAD
peer_reviewer: GriffinAD
status: Proposed
last_review: YYYY-MM-DD
adrs: []
invariants: []
---

# <Tier B doc title>

> **Tier B** — subsystem / domain. Gate 1 or Gate 2 deliverable (see frontmatter).
> Cites Tier A; is cited by Tier C and by implementation code later.

## Scope

What subsystem or domain this covers, plus explicit non-goals.

## Responsibilities

Numbered list of this subsystem's responsibilities. Anything not listed is out
of scope for this doc.

## Contracts consumed

Contracts this subsystem depends on. Each must exist in `specs/`.

| Contract | From | Notes |
|---|---|---|

## Contracts published

Contracts this subsystem offers. Each must exist in `specs/`.

| Contract | Artefact | Notes |
|---|---|---|

## Invariants

Use the `INVARIANT_BLOCK_TEMPLATE.md` form. IDs unique + indexed.

<!--

### INV-<AREA>-<NAME>

- **Statement:** …
- **Rationale:** …
- **Enforcement:** …
- **Test hook:** …
- **Back-links:** …

-->

## Failure modes

What can go wrong, how we detect it, how we recover, how we report it. At
minimum: backpressure, partial failure, dependency down, resource exhaustion,
cancellation, restart mid-flight.

## Cross-refs

- Related ADRs: …
- Related Tier A / Tier B docs: …
- Related Tier C docs (versioning, errors, performance, testing): …

## Change Log

| Date | Status | Reviewer | Notes |
|---|---|---|---|
| YYYY-MM-DD | Proposed | TBD | Initial draft. |
