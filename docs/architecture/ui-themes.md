---
title: UI Themes Architecture
tier: C
gate: Rolling
owner: GriffinAD
peer_reviewer: GriffinAD
status: Accepted
last_review: 2026-04-22
adrs: []
invariants: []
---

<!-- markdownlint-disable MD025 -->
# UI Themes Architecture

## Scope

Defines theme token schema, plugin theming constraints, and contrast/accessibility
requirements across light/dark/custom themes.

## Acceptance criteria for Rolling close

- [x] Theme token schema finalized and validated (shell preferences + Flowbite
      CSS variables; see below).
- [x] Plugin theming boundary rules documented.
- [x] Contrast verification process defined (semantic gauge strokes + WCAG
      follow-through in `ui.md` / manual checks for new surfaces).
- [x] Theme migration rules for breaking token changes documented.

## Theme model

Themes are token sets layered over shell primitives. The operator shell
persists **user preferences** in the browser and maps them to the document root
so **Tailwind** `dark:` variants and **Flowbite** `default.css` design tokens
apply consistently.

### Shell preference JSON (`localStorage` key `kea-fabric-ui-theme`)

| Field | Type | Purpose |
| --- | --- | --- |
| `version` | `1` | Schema version; bump and migrate when shape changes. |
| `mode` | `"light"` \| `"dark"` \| `"system"` | Appearance: `system` follows `prefers-color-scheme`. |
| `colorPreset` | `"default"` \| `"emerald"` | Maps Flowbite `--color-primary-*` to the default blue scale or an emerald scale (`html[data-color-preset="emerald"]` in `apps/ui/src/app.css`). |

Invalid or missing JSON falls back to `{ "version": 1, "mode": "system", "colorPreset": "default" }`.

### Document effects

- `document.documentElement.classList` contains `dark` when the **effective**
  appearance is dark (so `@custom-variant dark` in `app.css` and Flowbite’s
  `.dark` block apply).
- `document.documentElement.dataset.colorPreset` mirrors `colorPreset` for CSS
  overrides.

### Plugin theming boundary

- **Prefer** shared shell patterns: `dark:` utility pairs, Flowbite components,
  and future semantic utilities documented here—avoid new one-off color stacks in
  plugins.
- **Do not** add parallel font, icon, or third-party design systems (see `ui.md`,
  `ui-icons.md`, `ui-fonts.md`, ADR-0046).
- Untrusted or iframe-hosted UIs remain isolated per `ui.md`; this document
  governs **in-process** Svelte plugin tiles only.

### Performance gauge arc colors (semicircle)

The **track** is neutral; the **filled** portion is drawn as one or more SVG
sub-arcs. Colors are fixed **along the arc** (as a fraction of full path length):

- `0–70%` of the arc — green; `70–80%` — yellow; `80–90%` — orange; `90–100%` — red.

The **value** (0–100) is how far the fill extends along that spectrum. For
example, at **95%** the visible fill shows **four** colors (green, then yellow,
then orange, then red for the last 5% of the arc). At **50%**, only the green
portion appears (the first half of the arc lies entirely in the 0–70% band).

Implementation: `gaugeArcSegmentsForFill` in
`apps/ui/src/lib/components/gaugeThresholds.ts` and
`describeSemicircleSegment` in `gaugeMath.ts`.

### Contrast and verification

- New chrome or tiles should be checked in **light and dark** effective modes
  and, when using `colorPreset`, in **default** and **emerald** accents.
- Error and success text should use existing semantic reds/greens; gauge progress
  uses the zone `stroke-*` classes defined next to `gaugeArcSegmentsForFill`.

### Breaking changes and migration

- If `kea-fabric-ui-theme` fields are renamed or `version` is incremented,
  provide a one-time read of legacy keys in `loadThemePreferences` (or bump
  `version` and reset to defaults) and document the change in this file’s
  **Change Log**.

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
| 2026-04-22 | Accepted | GriffinAD | Documented storage schema, `data-color-preset`, gauge bands, plugin rules. |
