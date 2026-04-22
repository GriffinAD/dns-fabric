---
title: Platform Support Architecture
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
# Platform Support Architecture

## Scope

Defines supported OS/arch tiers, runtime prerequisites, and boot-time platform
capability checks.

## Acceptance criteria for Rolling close

- [ ] Tier-1 and Tier-2 support matrix finalized.
- [ ] Out-of-scope platforms explicitly documented.
- [ ] Capability probe requirements mapped to startup behavior.
- [ ] Packaging/deployment docs aligned to support matrix.

## Platform outline

Use explicit support tiers and deterministic capability probing to avoid partial
or undefined behavior on unsupported environments.

## Cross-refs

- `core-runtime.md`
- `packaging.md`
- `deployment.md`
- `kea-integration.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C platform-support architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
