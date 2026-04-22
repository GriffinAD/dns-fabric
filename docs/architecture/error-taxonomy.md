---
title: Error Taxonomy
tier: C
gate: Rolling
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-19
adrs: []
invariants: []
---

<!-- markdownlint-disable MD025 -->
# Error Taxonomy

## Scope

Defines canonical error classes, codes, and mappings across API, events, and
CLI outcomes.

## Acceptance criteria for Rolling close

- [ ] Error namespace table complete and conflict-free.
- [ ] RFC 7807 mapping documented for API surfaces.
- [ ] Event and CLI error mappings aligned.
- [ ] Test plan ensures stable machine-readable error contracts.

## Taxonomy outline

Errors are grouped into validation, authorization, dependency, state,
conflict/idempotency, timeout, and internal categories.

## Cross-refs

- `api.md`
- `events.md`
- `contracts.md`
- `testing.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C error taxonomy draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
