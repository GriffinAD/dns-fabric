---
title: UI Icons Architecture
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
# UI Icons Architecture

## Scope

Defines semantic icon ID registry, shell ownership model, and plugin usage
constraints.

## Acceptance criteria for Rolling close

- [ ] Semantic icon namespace and ownership policy documented.
- [ ] `<kf-icon>` contract finalized with accessibility requirements.
- [ ] Build pipeline constraints for SVG assets documented.
- [ ] Theme-aware icon adaptation rules documented.

## Icon model

Plugins reference semantic IDs only; raw SVG payloads do not cross plugin
boundaries.

## Cross-refs

- `ui.md`
- `contracts.md`
- `ui-design-system.md`
- `ui-themes.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C UI icons architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
