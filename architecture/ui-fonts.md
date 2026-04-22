---
title: UI Fonts Architecture
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
# UI Fonts Architecture

## Scope

Defines primary and fallback font strategy, hosting policy, subsetting, and
performance constraints for multilingual support.

## Acceptance criteria for Rolling close

- [ ] Primary/fallback font matrix finalized.
- [ ] Self-hosting and preload policy documented.
- [ ] Locale-driven fallback behavior documented.
- [ ] Font budget and regression checks integrated.

## Font model

Use self-hosted webfonts with locale-aware fallback stacks and explicit size
budgets.

The shell entry (`apps/ui/src/main.ts`) loads **Latin subsets** only for Inter
(400/600) and JetBrains Mono (400), and injects matching `woff2` **preload**
hints before the `@fontsource/*` CSS so first paint avoids a late font fetch.
Extend imports (for example `latin-ext` or Cyrillic) when non-Latin locales
ship.

## Cross-refs

- `ui.md`
- `i18n.md`
- `ui-themes.md`
- `performance.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C UI fonts architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
