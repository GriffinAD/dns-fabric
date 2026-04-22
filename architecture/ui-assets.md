---
title: UI Assets Architecture
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
# UI Assets Architecture

## Scope

Defines static asset pipeline, cache strategy, CSP constraints, and UX-state
assets (error/empty/loading).

## Acceptance criteria for Rolling close

- [ ] Asset classes and ownership documented.
- [ ] Cache-busting and long-cache policy defined.
- [ ] CSP-safe asset loading rules documented.
- [ ] Error/empty/loading asset requirements specified.

## Asset model

Static assets are content-hashed, policy-scoped, and delivered with predictable
cache semantics.

## Cross-refs

- `ui.md`
- `ui-design-system.md`
- `performance.md`
- `security.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C UI assets architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
