---
title: UI Design System Architecture
tier: C
gate: Rolling
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-22
adrs: [ADR-0046, ADR-0047]
invariants: []
---

<!-- markdownlint-disable MD025 -->
# UI Design System Architecture

## Scope

Defines design-token source of truth, component primitives, and visual
consistency validation strategy.

## Acceptance criteria for Rolling close

- [ ] Token taxonomy and ownership documented.
- [ ] Component primitive catalogue defined.
- [ ] Visual regression strategy integrated in CI.
- [ ] Accessibility baseline checks documented.

## Design system outline

Shell-owned tokens and components provide stable primitives; plugin UIs consume
published tokens and contracts rather than ad-hoc styles.

**Third-party primitive layer:** Flowbite Svelte v2 components (ADR-0046) supply
tables, modals, form controls, and other chrome. **Data charts** use the
**Flowbite Svelte chart plugin**; small bespoke **SVG** remains in scope for
lightweight readouts (ADR-0047). The shell **wraps or themes** primitives so
tokens, spacing, and dark-mode behavior stay consistent with `ui-themes.md`.
Plugins must not import parallel icon or font stacks; see `ui-icons.md` and
`ui-fonts.md`.

## Cross-refs

- `ui.md`
- `ui-themes.md`
- `ui-icons.md`
- `testing.md`

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-19 | Proposed | GriffinAD | Initial Tier C UI design-system architecture draft. |
| 2026-04-19 | Accepted | GriffinAD | Self-review; Tier C Rolling baseline acceptance (doc gates closed). |
| 2026-04-22 | Accepted | GriffinAD | Noted Flowbite Svelte v2 + Tailwind bridge (ADR-0046). |
| 2026-04-22 | Accepted | GriffinAD | Noted ADR-0047 (charts via Flowbite Svelte plugin + bespoke SVG). |
