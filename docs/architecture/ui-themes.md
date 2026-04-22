---
title: UI Themes Architecture
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
# UI Themes Architecture

## Scope

Defines theme token schema, plugin theming constraints, and contrast/accessibility
requirements across light/dark/custom themes.

## Acceptance criteria for Rolling close

- [ ] Theme token schema finalized and validated.
- [ ] Plugin theming boundary rules documented.
- [ ] Contrast verification process defined.
- [ ] Theme migration rules for breaking token changes documented.

## Theme model

Themes are token sets layered over shell primitives; plugin UIs consume semantic
tokens only.

## Cross-refs

- `ui.md`
- `ui-design-system.md`
- `ui-icons.md`
- `i18n.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C UI themes architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
