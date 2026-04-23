---
title: "ADR-0046: Operator UI component stack (Flowbite Svelte v2 + Tailwind CSS v4)"
adr: 0046
status: Accepted
date: 2026-04-22
owner: GriffinAD
peer_reviewer: GriffinAD
deciders: [GriffinAD]
due_date: null
re_entry_criteria: null
touch_points: []
---

# ADR-0046: Operator UI component stack (Flowbite Svelte v2 + Tailwind CSS v4)

## Status

Accepted

## Context

The operator shell in `apps/ui` needs a consistent, accessible component layer
for dashboards and admin surfaces (see `dashboard-plugin-blueprint.md`).
Svelte 5 is already chosen (ADR-0006). We need a decision on **third-party
UI primitives** (buttons, tables, modals, tabs) versus hand-rolling everything.

Constraints:

- Align with **Tailwind CSS** utility styling already assumed by Flowbite.
- Stay compatible with **Svelte 5** and **Vite**.
- **Icons** remain **Lucide** via the semantic registry (ADR-0016); Flowbite
  icon packs are not the product icon source of truth.
- **Fonts** remain **self-hosted** Inter + JetBrains Mono (ADR-0017); do not
  rely on Google Fonts CDN snippets from vendor docs.
- Shell-owned design tokens and themes remain authoritative in
  `ui-design-system.md` and `ui-themes.md`; the stack must allow a **token
  bridge** (CSS variables / Tailwind theme) without forking vendor bundles.

## Decision drivers

- Delivery speed for Operational Readiness v1 operator surfaces.
- Accessibility and keyboard behavior from a maintained component set.
- Ability to theme (including dark mode) without fighting the library.
- License and supply-chain sanity (MIT ecosystem).

## Considered options

1. **Flowbite Svelte v2 + Tailwind v4** — native Svelte components aligned with
   Flowbite design language; v2 track matches Tailwind v4.
2. **Headless primitives only** (e.g. Melt UI) + full custom styling — maximum
   control, higher build cost for tables, date pickers, and complex widgets.
3. **Alternative full kit** (e.g. different Svelte component library) — would
   duplicate evaluation effort and split documentation.

## Decision outcome

Chosen option: **Flowbite Svelte v2 + Tailwind CSS v4** in `apps/ui`, installed
per the upstream getting-started flow (`flowbite-svelte` v2 prerelease track,
`flowbite`, `@tailwindcss/vite`, `flowbite-typography` as needed), with
**`@source`** directives so Tailwind scans library classes.

### Positive consequences

- Faster iteration on dashboard and admin layouts using documented components.
- Dark mode and typography plugins integrate with the same CSS pipeline.
- Clear upgrade path alongside upstream Flowbite Svelte v2 stabilization.

### Negative consequences

- **Third-party coupling** to Flowbite class names and release cadence.
- **Prerelease** v2 dependency until the project ships a stable major
  (upstream stabilization in progress).
- Occasional friction keeping **shell tokens** and Flowbite defaults aligned
  (mitigated by a thin wrapper layer where needed).

## Validation

This ADR is **falsified** if any of the following hold for more than one
release cycle without an explicit follow-on ADR:

- We cannot ship **WCAG 2.2 AA** baseline flows using the chosen components
  without unsafe overrides.
- **Tailwind v4** or **Svelte 5** upgrades are blocked indefinitely by the
  stack with no upstream path.
- **Lucide + registry** (ADR-0016) or **self-hosted fonts** (ADR-0017) are
  violated in production bundles.

CI must keep **`apps/ui`** building with **`svelte-check`**, **Vitest**, and
**Playwright** smoke tests as defined in `testing.md` and `.github/workflows/ui.yml`.

## Pros and cons of the options

| Option | Pros | Cons |
| --- | --- | --- |
| Flowbite Svelte v2 + Tailwind v4 | Fast feature velocity; docs + MCP; matches dashboard plan | Vendor lock-in; v2 still stabilizing |
| Headless only | Full styling ownership | High cost for complex widgets |
| Other kit | Possible better fit for niche | Re-documents decisions; splits ecosystem |

## Links

- [Flowbite Svelte v2 — introduction](https://flowbite-svelte-v2.vercel.app/docs/pages/introduction)
- `docs/architecture/ui.md`
- `docs/architecture/ui-design-system.md`
- `docs/architecture/dashboard-plugin-blueprint.md`
- ADR-0006 (Svelte 5 shell), ADR-0016 (Lucide), ADR-0017 (fonts)
- ADR-0047 (data charts: Flowbite Svelte chart plugin + bespoke SVG)

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-22 | Accepted | GriffinAD | Record Flowbite Svelte v2 + Tailwind v4 as operator UI primitive stack. |
