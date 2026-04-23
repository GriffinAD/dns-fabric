# UI Engine Review — `phase-d` branch

Date: 2026-04-23
Scope: everything under `apps/ui/` (shell + dashboard + plugins + mocks), read-only
against `main` doc set. This document is the **diagnosis**; the "as it should be"
picture is in [`UI_ENGINE_SPEC.md`](UI_ENGINE_SPEC.md) and the action list is in
[`UI_ENGINE_PLAN.md`](UI_ENGINE_PLAN.md).

This is a working document, not an Accepted Tier A/B/C architecture doc. It
deliberately lives at the repo root so it is easy to find and does not have to
clear the doc gates. If we want to promote any of it into `docs/architecture/`
(e.g. as updates to `dashboard-plugin-blueprint.md`) we'll do that through the
normal ADR/doc workflow.

---

## 1. Executive summary

The user's gut feel is correct: the `phase-d` branch has shipped a working
12-column dashboard with groups, DnD, overlays and theming, but the **engine /
plugin boundary has leaked**. The shell (`App.svelte`), the host
(`DashboardHost.svelte`), the layout engine (`gridPlacement.ts`) and the
settings overlay (`TileSettingsOverlay.svelte`) all carry plugin-specific
knowledge (`perf.summary`, `perf.ram`, `perf.cpu`, DHCP list pattern, …). There
is **no registry, no uniform `DashboardPlugin` contract, and no policy boundary
between "how tiles render" and "how the grid behaves"**. The blueprint at
`docs/architecture/dashboard-plugin-blueprint.md` describes the correct
structure; the code does not yet implement it.

The fix is not a rewrite. It is:

1. Promote the implicit plugin contract into an **explicit TS interface +
   registry** (bring `renderTile` to heel).
2. Strip plugin literals out of the engine (`tileColSpan`, `onPerfTileGridHint`,
   `parseDashboardLayout` options validator, strip-width duplication).
3. Decompose `TileSettingsOverlay` and `DashboardHost` so plugins own their own
   settings fragments and their own "grid hints", and so read-view vs edit-view
   live on one code path.
4. Lock the network edge: debounce `PUT layout`, stop swallowing errors, and
   Zod-validate layout ingress (today Zod runs in tests only).

No behaviour change is required for v1; this is purely an engine-cleanup pass
that makes v1 finishable and v2 plugins cheap.

---

## 2. What "the dashboard engine" is today

Concretely, today the engine is the union of:

- `apps/ui/src/App.svelte` — shell + routing + layout owner + SSE dispatch +
  overlay state + perf-specific layout policy. ~459 lines.
- `apps/ui/src/lib/dashboard/DashboardHost.svelte` — DnD + palette + drop
  targets + grid CSS + **plugin component dispatch** (`renderTile` is a hard
  `if/else if` on `pluginId`). ~746 lines.
- `apps/ui/src/lib/dashboard/gridPlacement.ts` — 12-column math, packing,
  reorder, strip extents, CSS helpers. ~29 KB, heavily tested.
- `apps/ui/src/lib/dashboard/layoutTree.ts` — v1→v2 migration, find/map/move
  over the tree.
- `apps/ui/src/lib/dashboard/layoutStorage.ts` — hand-rolled validator +
  localStorage round-trip + legacy plugin stripping.
- `apps/ui/src/lib/dashboard/types.ts` — data shape; single source for
  `DashboardLayoutV1 | V2`, `RootLayoutItem`, `DashboardTile`, `DashboardGroup`.
- `apps/ui/src/lib/dashboard/TileSettingsOverlay.svelte` — ~579 lines: grid
  form + parent-picker + manifest-driven host/display mode + **large
  `{#if draft.pluginId === "perf.*"}` branches** for perf options.
- `apps/ui/src/lib/dashboard/GroupSettingsOverlay.svelte` — ~220 lines, focused.
- `apps/ui/src/lib/dashboard/{TileEditChrome,GroupReadNoWrap,DashboardControls}.svelte`,
  `dashboardSettings.ts`, `rowPanelLayout.ts`, `gaugeGridLayout.ts`,
  `defaultLayout.ts`.
- `apps/ui/src/lib/plugins/*.svelte` — one Svelte component per pluginId.
- `apps/ui/src/lib/components/SemicircleGauge.svelte` + `gaugeMath.ts` +
  `gaugeThresholds.ts` — shared primitive, today only used by perf tiles.
- `apps/ui/src/lib/theme/{themeStorage.ts,ThemeControls.svelte}`.
- `apps/ui/src/lib/api/{types.ts,openapiZod.ts}` + `dataGateway.ts`.
- `apps/ui/src/mock/{fixtures.ts,handleMockApi.ts,routes.ts}` +
  `vite-plugin-mock-api.ts`.
- `specs/dashboard/layout.schema.json` — JSON Schema (the real contract) and
  `specs/contracts/ui_dashboard_plugin.py` — Python `Protocol` **stub** with
  only `plugin_id`.

The good news: **the data contract (layout schema, API types) is clean and
already published**. The bad news: **the runtime contract for a plugin ("what
is a dashboard plugin, as code?") does not exist in the repo.**

---

## 3. Concrete findings (file:line)

### 3.1 Plugin ids leak into the engine layer

| # | Where | What |
|---|---|---|
| 1 | `apps/ui/src/lib/dashboard/gridPlacement.ts` ~34-44 (`tileColSpan`) | Default column span is a switch on `pluginId`: `perf.summary → 12`, `perf.cpu/ram/nw/disk → 1`, everything else `6`. |
| 2 | `apps/ui/src/lib/dashboard/gridPlacement.ts` ~494-504 (`alignGaugeColumnCount`) | Perf-dashboard alignment math in a file that otherwise speaks only geometry. |
| 3 | `apps/ui/src/lib/dashboard/layoutStorage.ts` ~17 (`LEGACY_PLUGIN_IDS`) and ~224-237 | Storage drops rows by pluginId. Legacy-migration policy, not storage. |
| 4 | `apps/ui/src/lib/dashboard/layoutStorage.ts` ~50-64 (`isTileOptions`) | Schema validator for `tile.options` hardcodes perf fields (`cpu_total`, `network_by_adapter`, `disk_by_volume`, `display_style`, `perf_max_cols`). Any non-perf plugin adding an option field requires engine edits. |
| 5 | `apps/ui/src/App.svelte` ~306-335 (`onPerfTileGridHint`) | Shell special-cases `perf.ram` vs other perf plugins when deciding whether to shrink colSpan to 1. Plugin-specific grid policy at the top of the tree. |
| 6 | `apps/ui/src/lib/dashboard/DashboardHost.svelte` ~290-355 (`renderTile`) | Fixed `if pluginId === "dhcp.pools" {...} else if pluginId === "perf.summary" {...}` chain. No registry. Falls through to a placeholder `Card` for any unknown id. |
| 7 | `apps/ui/src/lib/dashboard/TileSettingsOverlay.svelte` ~325-559 | Long `{#if draft.pluginId === "perf.*"}` blocks that re-implement the same perf toggles (display style, max cols) per plugin with small variations. |

### 3.2 Host mixes policy, rendering and DnD

`DashboardHost.svelte` (~746 lines) owns:

- palette markup + HTML5-drag payload encoding,
- `svelte-dnd-action` root + per-group zones (`handleRootConsider`,
  `handleGroupConsider(gid)`, …),
- grid CSS emission (`gridAreaStyle`, `groupGridAreaStyle`, inline `style=`
  track math for strip mode),
- tile chrome overlay (drag handle / edit / delete),
- the `renderTile` plugin switch,
- strip-width `ResizeObserver` for Auto-wrap off (`noWrapStripPortMeasure`,
  mirrored in `GroupReadNoWrap.svelte`),
- view-vs-edit path divergence (`noWrapReadRowGroups` single scroller vs the
  editor's per-tile inline width computation).

This is at least three responsibilities welded together. The clearest symptom
is the duplicated strip measurement logic between `DashboardHost` and
`GroupReadNoWrap`.

### 3.3 `App.svelte` is a giant glue layer

Approximate split of 459 lines:

| Responsibility | Lines |
|---|---|
| Imports | ~41 |
| Top-level state | ~10 |
| Hash routing | ~15 |
| Overlay open/close + save (`mapTileInLayout`, `moveTileToParent`, `mapRootItemsReplaceGroup`) | ~50 |
| Overlay-derived props (`settingsParentId`, `settingsTileContainerG`, `parentOptions`, `tileSettingsContainerMeta`) | ~25 |
| Delete root/child | ~22 |
| `selectDashboardView` (commit wraps) | ~10 |
| `onMount` — plugins + layout + SSE + theme | ~53 |
| Add tile/group/tile-to-group | ~36 |
| `applyLayoutStructure` (normalize + persist + PUT) | ~22 |
| `resetLayoutToBaseline` | ~14 |
| `onPerfTileGridHint` (plugin-specific) | ~30 |
| Markup (header + toolbar + DashboardHost + overlays) | ~120 |

Everything except hash routing and global chrome is dashboard-engine work.
`App.svelte` should shrink to "what page is mounted and what global toolbar
renders" once we have a `DashboardPage.svelte` + a layout store.

### 3.4 Tile settings overlay is the biggest smell

`TileSettingsOverlay.svelte` is ~579 lines because the plugin-agnostic form
(grid + parent + display mode + host control) and the plugin-specific form
(perf options, gauge style, per-plugin max cols) live in the same component.
Each new plugin that has options means editing this file.

Signals this is wrong:

- `{#if draft.pluginId === "perf.*"}` ladders for 4–5 ids with near-identical
  markup.
- Options schema duplicated against `layoutStorage.ts`'s `isTileOptions` and
  against `tile.options` typing in `api/types.ts`.
- Clamp logic (`layoutModeForParent`, `clampGroupChildGridPlacement` vs
  `clampTileGridPlacement`) reimplements rules from `gridPlacement.ts` inline.

### 3.5 Network edge is chatty and silent

- `apps/ui/src/App.svelte` ~268-288 (`applyLayoutStructure`) calls
  `gateway.putDashboardLayout("default", normalized)` on **every** structural
  update and swallows errors with `.catch(() => {})`. There is no
  debouncing / batching — the blueprint claims a ~400 ms debounce but no
  debounce exists in `apps/ui/src/App.svelte`.
- `apps/ui/src/lib/dataGateway.ts` `subscribeFabricEvents` is the only SSE
  consumer; only `App.svelte` subscribes; only `cpu_percent_total` is surfaced
  (as `liveCpuPercent`). Every other tile is poll-only (`onMount`).
- `apps/ui/src/lib/api/openapiZod.ts` is **only** invoked in
  `openapiZod.test.ts`. Dev-mock + real-server responses are not Zod-validated
  on the wire.

### 3.6 Storage has dual sources of truth

1. `App.svelte` initialises `layout` from
   `initialDashboardLayout()` (localStorage) at ~44.
2. `onMount` then fetches from the server and **overwrites** localStorage with
   the parsed version (~198-206). If the server is unreachable, localStorage
   wins.

This works but causes a visible flash and makes "the layout I just saved" /
"the layout the server has" occasionally differ until the next PUT lands. We
should pick a single canonical source (server, with localStorage as offline
cache) and model the precedence explicitly.

### 3.7 Forward compat: schema is pinned at v2

`parseDashboardLayout` rejects `version > 2`
(`apps/ui/src/lib/dashboard/layoutStorage.ts` ~170-172). A v3 payload from a
newer server causes the shell to **drop to localStorage** silently rather than
loudly degrading. The schema in `specs/dashboard/layout.schema.json` also
`oneOf`-gates v1/v2. Planning for v3 migration has no hook.

### 3.8 Duplication we can retire

- Strip-width math in `DashboardHost.svelte` (~183-194) and
  `GroupReadNoWrap.svelte` — one helper, two callers.
- DHCP tiles: `DhcpPoolsTile`, `DhcpClientsTile`, `DhcpReservationsTile` all
  do Card → onMount → `gateway.listX()` → Flowbite `Table`. One **data-table
  plugin factory** would replace them.
- Perf tiles: `CpuTile`, `RamTile`, `NwTile`, `DiskTile` are thin wrappers
  that each pass one string to `PerfMetricTile` (6-25 lines each). They can be
  register-as-data, not as files.

### 3.9 `tile.displayMode` and `tile.hostControl` are largely vestigial

The data contract exposes `displayMode: "compact" | "full"` and `hostControl:
"single-panel" | "tab-control" | "vertical-stack" | "split-grid"`, and the
blueprint mandates both. In code:

- `displayMode` is read by **only** `DhcpClientsTile.svelte` (hides Vendor and
  Lease columns on `compact`).
- All other tiles ignore it.
- `hostControl` is persisted, validated, and editable in the overlay, but **no
  tile component reads it**. There is no `TabControlHostControl`,
  `VerticalStackHostControl`, or `SplitGridHostControl` implementation.

So the runtime exhibits `single-panel` for every tile. The blueprint's
four-host-control design is paper only.

### 3.10 Fault isolation is on paper

The blueprint requires: "A failing plugin must not crash host rendering" and a
placeholder with reason + recovery action for missing/disabled plugins.

Today:

- Unknown `pluginId` gets a minimal grey "Unknown plugin (placeholder)." Card
  (`DashboardHost.svelte` ~346-354). No reason, no recovery action, no
  `enabled === false` handling.
- A tile that throws during render bubbles to the nearest Svelte error boundary
  (there isn't one configured); there is no per-tile catch.

### 3.11 Tests: strong on geometry, thin on orchestration

Vitest lives in:

- `lib/api/openapiZod.test.ts`
- `lib/components/{gaugeMath,gaugeThresholds}.test.ts`
- `lib/dashboard/{gridPlacement,layoutStorage,layoutTree,dashboardSettings,gaugeGridLayout,layout,rowPanelLayout}.test.ts`
- `lib/{dataGateway,mockRoutes,uiVersion}.test.ts`
- `lib/theme/themeStorage.test.ts`

Playwright lives in `apps/ui/tests/e2e/{smoke,dashboard}.e2e.ts` +
`fixtures/editorGridFixture.ts`.

Gaps:

- No unit tests on `App.svelte`'s GET → parse → PUT pipeline.
- No unit tests on `DashboardHost`'s DnD commit path.
- No unit tests on `TileSettingsOverlay`'s perf branches.
- No tests for `onPerfTileGridHint`'s `perf.ram` vs others policy.
- Zod validation never runs in production code path.

### 3.12 Deprecated / dead-ish files still around

- `apps/ui/src/mock/routes.ts` — deprecated re-export of `baseFixtures`.
- `rowPanelLayout.ts` — supports the v1 `rowPanel` migration path which is only
  reached from `migrateV1ToV2`. Fine to keep in one migration helper; shouldn't
  be a separate "panel" concept alongside groups.

---

## 4. Severity summary

| Cluster | Severity | Reason |
|---|---|---|
| Plugin-id literals in engine + host | **High** | Every new plugin forces edits in 3–4 engine files. Direct cause of "hacky" feel. |
| `TileSettingsOverlay` monolith | **High** | Biggest single file to touch when adding a plugin option. |
| `putDashboardLayout` undebounced + silent | **High** | Real data-loss/observability risk; contradicts the blueprint. |
| `App.svelte` concentration of responsibility | **Medium** | Painful to test; hash-routing + layout + SSE + overlays in one file. |
| Read-view vs edit-view strip duplication | **Medium** | Any layout bug has to be fixed twice. |
| `hostControl` / `displayMode` / `Compact`-`Full` paper-only | **Medium** | Data contract promises features the code doesn't deliver. |
| Zod is test-only | **Medium** | Drift between server and UI types caught only by mocks. |
| Dual source-of-truth for layout on boot | **Low** | Works today; fragile if the server and local disagree. |
| Forward compat (`version > 2` rejected) | **Low** | Will bite at v3 bump. |
| Fault-isolation placeholder is weak | **Low** | Cheap to improve; not on fire. |

The High items are the ones that caused the "felt hacky" impression. Fixing
them eliminates ~60% of the boilerplate in the next plugin PR.

---

## 5. What we should **not** change

- The **data contracts** (`specs/api/openapi.yaml` + `specs/dashboard/layout.schema.json`)
  are correct. Don't change shapes; fix code to honour them.
- The **geometry engine** (`gridPlacement.ts`) is the strongest part of the
  codebase. It has dense tests and clean pure functions. Do not rewrite — only
  extract plugin literals out of it.
- The **theme system** is tidy and already the right size.
- The **v1 product goal** (operator can compose DHCP + perf tiles on a
  12-column grid) is delivered. Don't lose that while refactoring.

---

## 6. Link to next documents

- [`UI_ENGINE_SPEC.md`](UI_ENGINE_SPEC.md) — what the engine is in engine
  terms: kernel, plugin contract, registry, host controls, layout pipeline,
  data edge.
- [`UI_ENGINE_PLAN.md`](UI_ENGINE_PLAN.md) — ordered, reviewable work items to
  get from the current code to the spec without breaking v1.
