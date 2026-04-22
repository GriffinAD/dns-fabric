---
title: Deployment Architecture
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
# Deployment Architecture

## Scope

Defines deployment topologies, upgrade/rollback strategy, and operational smoke
checks across single-node, warm-standby, Kubernetes, and air-gapped contexts.

## Acceptance criteria for Rolling close

- [ ] Topology diagrams and prerequisites complete.
- [ ] Upgrade and rollback runbooks validated.
- [ ] Post-deploy smoke checks codified.
- [ ] Failure/incident response links included.

## Deployment outline

Support deterministic deployments with explicit promotion criteria and
repeatable rollback paths.

## Cross-refs

- `overview.md`
- `nebula-sync.md`
- `packaging.md`
- `cicd.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C deployment architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
