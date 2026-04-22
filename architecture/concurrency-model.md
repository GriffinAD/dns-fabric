---
title: Concurrency Model
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
# Concurrency Model

## Scope

Defines asyncio-oriented concurrency rules, thread/process boundaries,
cancellation semantics, and shared-state constraints.

## Acceptance criteria for Rolling close

- [ ] Concurrency rules published for core and plugin code.
- [ ] Cancellation semantics tested across critical flows.
- [ ] Thread boundary exceptions explicitly documented.
- [ ] Deadlock/starvation mitigation strategy defined.

## Model outline

Single event-loop orchestration with bounded worker pools for blocking edges;
explicit cancellation points and cooperative shutdown ordering.

## Cross-refs

- `core-runtime.md`
- `scheduler.md`
- `testing.md`
- `performance.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C concurrency model draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
