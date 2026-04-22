---
title: Versioning Architecture
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
# Versioning Architecture

## Scope

Defines semver policy across platform, plugin manifests, contracts, events, API,
and CLI surfaces.

## Acceptance criteria for Rolling close

- [ ] Version matrix published for all externally visible surfaces.
- [ ] Breaking-change process linked to ADR workflow.
- [ ] Deprecation windows defined with communication policy.
- [ ] Compatibility tests mapped to release pipeline.

## Versioning model

Major versions denote incompatible contract changes; minor versions add backward
compatible capability; patch versions fix defects without contract drift.

## Cross-refs

- `contracts.md`
- `api.md`
- `events.md`
- `release-process.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C versioning draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
