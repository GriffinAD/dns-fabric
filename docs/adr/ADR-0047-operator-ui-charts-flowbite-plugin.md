---
title: "ADR-0047: Operator UI charts (Flowbite Svelte chart plugin + bespoke SVG)"
adr: 0047
status: Accepted
date: 2026-04-22
owner: GriffinAD
peer_reviewer: GriffinAD
deciders: [GriffinAD]
due_date: null
re_entry_criteria: null
touch_points: []
---

# ADR-0047: Operator UI charts (Flowbite Svelte chart plugin + bespoke SVG)

## Status

Accepted

## Context

The operator shell (`apps/ui`) will need **data charts** in more than one
place: time-series and histogram-style views in dashboards, admin or discovery
summary surfaces, and likely future plugin tiles. The stack already standardizes
on **Flowbite Svelte v2** and **Tailwind CSS v4** (ADR-0046). Small **custom SVG**
primitives (for example semicircle load gauges) are already used where a full
charting stack is unnecessary.

Upstream, **Flowbite Svelte** is moving **chart** support out of the core
library toward an official **plugin** package (`@flowbite-svelte-plugins/chart`),
and older standalone chart packages in the ecosystem have been **deprecated** in
favor of that path. We need a single product decision so new features do not
import competing chart engines ad hoc.

## Decision drivers

- Align with the same Flowbite Svelte + Tailwind pipeline as the rest of the
  shell.
- One supported path for **time-series, categories, and similar data charts** so
  theming, upgrades, and accessibility reviews stay tractable.
- Keep **bundle size** proportionate: use a shared chart layer only where a
  library adds real value; keep bespoke SVG for tiny, static visualizations.
- Dark mode and **semantic tokens** (`ui-themes.md`) must apply without one-off
  chart skins per tile.

## Considered options

1. **Official Flowbite Svelte chart plugin** (`@flowbite-svelte-plugins/chart`
   per upstream docs) — same vendor line as ADR-0046; documents migration from
   older Flowbite Svelte in-tree chart APIs.
2. **Headless or alternate charting** (e.g. raw **ApexCharts**, **Chart.js**,
   **uPlot**) integrated manually — more control, more glue code and theming
   work for each addition.
3. **Multiple chart libraries** by feature — fastest short-term, worst for
  consistency, bundle size, and a11y review load.

## Decision outcome

Chosen approach: a **split**:

1. **Data charts (line, area, bar, and similar “real” chart widgets)**  
   **Standardize on the official Flowbite Svelte chart plugin**  
   (`@flowbite-svelte-plugins/chart` as published for the Flowbite Svelte v2
   line), including its documented CSS `@source` for Tailwind content scanning.  
   New dashboard or shell surfaces that need charts **should** use this
   package unless a follow-on ADR supersedes it.

2. **Bespoke SVG** (parametric paths, small gauges, single-metric readouts)  
   **Remain allowed and preferred** where a full chart engine would add
   weight without benefit. Existing examples live under
   `apps/ui/src/lib/components/` (for example `SemicircleGauge` and
   `gaugeMath.ts`).

**Theming:** chart instances must be configured or wrapped so **light/dark** and
**accent presets** follow `ui-themes.md` and `app.css`; no parallel color scales
in plugin tiles for shell-owned chrome.

**Icons and fonts** remain subject to ADR-0016 and ADR-0017 (charts do not
introduce a second icon font or CDN font path).

### Positive consequences

- One documented upgrade path with Flowbite Svelte releases and plugin
  documentation.
- Reuse across operator dashboard, admin, and future plugins without
  proliferating dependencies.
- Clear place to add **accessibility** and **testing** policy for chart
  widgets (Playwright + visual or snapshot checks as the product matures).

### Negative consequences

- Additional dependency(ies) in `apps/ui` and occasional upstream churn in a
  young plugin.
- **ApexCharts** (or the engine the plugin wraps) is heavier than hand-drawn
  SVG; must be loaded only for routes or tiles that need it where lazy loading
  is worthwhile.

## Validation

This ADR is **falsified** if any of the following hold for more than one
release cycle without a superseding ADR:

- A second **incompatible** charting stack ships in `apps/ui` for shell or
  first-party plugin UI without an explicit exception.
- **Dark mode** or **accent** themes systematically break for the chosen chart
  package with no plan to fix or replace it.
- The officially documented **Flowbite Svelte** chart plugin is **removed** or
  **unmaintained** with no replacement path—then re-open a chart ADR.

## Pros and cons of the options

| Option | Pros | Cons |
| --- | --- | --- |
| Flowbite Svelte chart plugin | Aligns with ADR-0046; documented migration; shared behavior | New plugin track; must verify Svelte 5 + Tailwind v4 at adopt time |
| Headless / raw ApexCharts (etc.) | Maximum control | More bespoke theming; diverges from Flowbite |
| Many libraries | Per-feature pick | Inconsistent UX, bloated JS, a11y holes |

## Links

- [Flowbite Svelte — Charts (plugin)](https://flowbite-svelte.com/docs/plugins/charts) (source of truth for package name and setup as it evolves)
- [Flowbite — Charts (Tailwind + ApexCharts)](https://flowbite.com/docs/plugins/charts/) (ecosystem background)
- `docs/architecture/ui.md`, `docs/architecture/ui-design-system.md`, `docs/architecture/ui-themes.md`
- ADR-0046 (operator UI component stack), ADR-0016 (icons), ADR-0017 (fonts)

## Change Log

| Date | Status | Reviewer | Notes |
| --- | --- | --- | --- |
| 2026-04-22 | Accepted | GriffinAD | Record Flowbite Svelte chart plugin for data charts; bespoke SVG for small gauges. |
