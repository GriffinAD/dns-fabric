# UI Engine Improvement Plan

Date: 2026-04-23
Companion to [`UI_ENGINE_REVIEW.md`](UI_ENGINE_REVIEW.md) (diagnosis) and
[`UI_ENGINE_SPEC.md`](UI_ENGINE_SPEC.md) (target).

This plan turns the review into ordered, reviewable commits. It is designed so
every phase:

- is **self-contained** (can ship as its own PR / commit on `phase-d` or a
  successor branch),
- **never breaks v1 behaviour** — existing e2e and Vitest stay green at every
  step,
- is **CI-enforceable** — where a smell goes away, we add a grep/lint guard so
  it doesn't come back,
- respects the **doc gate**: structural refactors come paired with an ADR and
  `dashboard-plugin-blueprint.md` updates where they change accepted
  contracts; pure engine cleanups that do not change contracts do not need
  ADRs.

Each phase has: **Goal**, **Changes**, **Done when**, **Risk**. Phases are
numbered; within a phase the individual items are labeled so they can become
commits or todos.

---

## Ground rules

1. **No scope creep** per phase. If work uncovers a bigger issue, file it at
   the bottom of this doc under "Follow-ups" and keep moving.
2. **Tests green between every item.** `bash scripts/check_app.sh`,
   `npm --prefix apps/ui run check:ui-unit`, and
   `npm --prefix apps/ui run check:ui-e2e` must pass before the next item starts.
3. **Behaviour parity is measured by Playwright.** The existing
   `apps/ui/tests/e2e/*.e2e.ts` suite is the behaviour contract; an item
   that changes those assertions needs explicit justification.
4. **Commits are one-concern.** Mechanical extracts (Phase 1) and semantic
   changes (Phase 2+) do not share a commit.
5. **Every new abstraction has its test.** `LayoutStore`, `ManifestRegistry`,
   `EventBus`, `TileErrorBoundary` each land with a Vitest file in the same
   commit.
6. Commit identity + DCO per `.cursor/rules/commits.mdc`.

---

## Execution status (living)

This section tracks what is **actually landed** vs the aspirational Phase 2 bullets
below (some of those describe a later “full registry” with `DataTableTile`, Zod,
and per-plugin settings fragments).

| Phase | Status | Notes |
|------|--------|--------|
| **P0** | Done | Plugin guard script, baseline dir / blueprint changelog per prior work. |
| **P1** | Done | `gridHints`, `dashboardBootstrap`, `overlayActions`, TileSettings split, `stripWidth`, mock routes test. **Line-count caps** for `App.svelte` / `DashboardHost.svelte` / overlay may still be open — treat as stretch. |
| **P2** | **Partial** | **Landed:** `builtinMeta.ts` (default col spans + RAM grid-hint rule, no Svelte imports), `registry.ts` with `ManifestRegistry`, `resolvePluginTileMount`, `PluginTileMount.svelte`, `DashboardHost` delegates tile body to mount (no `if/else` on plugin id there), `tileColSpan` / `handlePerfTileGridHint` use `builtinMeta`. Vitest: `builtinMeta.test.ts`, `registry.test.ts`. **Not done:** per-folder plugin indexes, `DataTableTile` merge, Zod + `TileFallback` in mount, `gridPolicy` on registry (still `builtinMeta` + TODO), `PerfOptionsForm` as registration fragment, **blocking** `check:ui-plugin-guard`. |
| **P3** | **Partial** | **Landed:** `layoutStore.ts` (`createLayoutStore`: writable layout/editor/source/errors, debounced `putDashboardLayout` 400ms, `flush` / `closeEditorAndFlush`, `persistError` vs `loadError`, `acceptServerLayout`, `markLayoutHydratedFromCacheOnly`, add-tile/group helpers, `resetToBaseline`). Bootstrap calls `onLayoutHydrationFromServerFailed` when GET layout fails. `App.svelte` wires store, cache badge, persist banner, `beforeunload` + flush when navigating home→admin. Vitest: `layoutStore.test.ts`, bootstrap hydration-failure test. **Not done:** Zod on gateway (P3.4), `layoutStorage` Zod (P3.5), migrations (P3.6–3.7), full spec API (`hintGrid`, `moveTile`, …), Flowbite toast, App line budget ≤130. |
| **P4–P8** | Not started | As in sections below. |

---

## Phase 0 — Safety net (≈ ½ day)

**Goal:** establish the before-picture and guardrails so no later phase can
regress silently.

**Changes:**

- **P0.1** Record baseline Playwright output (screenshots + trace) of the
  current dashboard with one of each existing tile, in read and edit mode.
  Keep under `apps/ui/tests/e2e/baseline/` (ignored from fixtures unless
  explicitly requested).
- **P0.2** Add a `check:ui-plugin-guard` npm script + CI step (in a disabled
  state, failing with the current codebase is expected) that greps for plugin
  id literals outside `apps/ui/src/lib/plugins/`. The script exists but is
  not yet a blocker; we flip it to blocking at the end of Phase 2.
- **P0.3** Add an `architecture/UI_ENGINE_REVIEW.md` / `…SPEC.md` /
  `…PLAN.md` mention from `docs/architecture/dashboard-plugin-blueprint.md`
  Change Log so reviewers know this body of work exists (no content move
  yet).

**Done when:** baseline screenshots captured, guard script present (even if
not enforcing yet), blueprint Change Log notes the working docs.

**Risk:** Near zero.

---

## Phase 1 — Mechanical decomposition (1 day)

**Goal:** shrink the oversized files by **moving**, not **changing**, code.
No behaviour change, no new abstractions; purely a file split.

**Changes:**

- **P1.1** Extract `onPerfTileGridHint` from `apps/ui/src/App.svelte`
  (~306-335) into `apps/ui/src/lib/dashboard/gridHints.ts`. Keep the
  plugin-id special case verbatim; leave a `TODO(P3)` pointing at the
  registry-based replacement. `App.svelte` imports it.
- **P1.2** Extract the mount-time data wiring (plugins load, layout load,
  SSE subscribe) from `App.svelte` `onMount` (~177-229) into
  `apps/ui/src/lib/dashboard/dashboardBootstrap.ts` — still exposes plain
  Svelte stores / handlers; `App.svelte` consumes them.
- **P1.3** Extract the overlay save/delete/move logic from `App.svelte`
  (~69-164) into `apps/ui/src/lib/dashboard/overlayActions.ts`.
- **P1.4** Split `TileSettingsOverlay.svelte`:
  - `TilePlacementForm.svelte` (grid + parent selector).
  - `TileGenericFields.svelte` (host control + display mode).
  - `PerfOptionsForm.svelte` (all `{#if pluginId === "perf.*"}` blocks
    moved here unchanged, still addressed by pluginId strings — that is
    Phase 2's problem).
  - `TileSettingsOverlay.svelte` becomes a composition of those three.
- **P1.5** Pull the strip-width `ResizeObserver` out of
  `DashboardHost.svelte` and `GroupReadNoWrap.svelte` into a shared
  `lib/dashboard/stripWidth.ts`. Both callers use the same helper.
- **P1.6** Delete the deprecated `apps/ui/src/mock/routes.ts` alias (nothing
  imports it except one no-op test; update the test to import `fixtures`
  directly).

**Done when:**

- `App.svelte` ≤ 220 lines.
- `DashboardHost.svelte` ≤ 550 lines.
- `TileSettingsOverlay.svelte` ≤ 280 lines (plus sibling form components).
- Existing Playwright + Vitest pass unchanged.
- No file outside `lib/plugins/` had a **new** `pluginId ===` literal added;
  `check:ui-plugin-guard` count is **not worse** than the baseline.

**Risk:** Low. These are file moves. Worst-case a regression is caught by
existing tests.

---

## Phase 2 — Plugin Host + Plugin registry (2–3 days)

**Goal:** retire the `renderTile` `if/else` and the engine's plugin-id
literals, via a `ManifestRegistry` and a `<PluginTileMount/>`.

**Changes:**

- **P2.1** Add `apps/ui/src/lib/plugins/registry.ts` exporting a
  `ManifestRegistry` instance (built-in ids seeded in the registry; optional
  `register()` for future dynamic plugins). Also export the `PluginRegistration`
  TS type (per [`UI_ENGINE_SPEC.md`](UI_ENGINE_SPEC.md) §3.4).
- **P2.2** Convert each existing plugin into a registration:
  - `lib/plugins/perf/index.ts` registers `perf.summary`, `perf.cpu`,
    `perf.ram`, `perf.network`, `perf.disk`. The four thin `CpuTile`,
    `RamTile`, `NwTile`, `DiskTile` files are replaced by
    `PerfMetricTile` + distinct registrations with `metric` in
    `defaultOptions`. `PerfTile.svelte` remains for `perf.summary`.
  - `lib/plugins/dhcp/index.ts` registers `dhcp.pools`, `dhcp.clients`,
    `dhcp.reservations` all pointing at **one** new `DataTableTile.svelte`
    primitive configured per-plugin (columns, fetcher, compact behavior).
    Today's three DHCP `.svelte` files are deleted.
  - `lib/plugins/discovery/index.ts` registers `discovery.records` →
    `DiscoveryTile.svelte` (kept).
- **P2.3** Introduce `apps/ui/src/lib/dashboard/PluginTileMount.svelte`.
  Props: `{ tile, hostContext }`. Resolves the registration, validates
  `tile.options` with the plugin's Zod schema (on failure, renders a
  `TileFallback` and logs), mounts the registered component.
- **P2.4** Replace the `renderTile` snippet in `DashboardHost.svelte` with
  `<PluginTileMount tile={…} hostContext={…}/>` — one site. Remove all
  plugin-id literals from `DashboardHost.svelte`.
- **P2.5** Replace `tileColSpan` switch in `gridPlacement.ts` with a lookup
  into the registry (`registry.get(pluginId)?.gridPolicy?.defaultSpan?.col`
  ?? fallback). Registry exposes a pure `defaultSpanFor(pluginId)` helper so
  `gridPlacement.ts` remains dependency-light.
- **P2.6** Move `alignGaugeColumnCount` into the perf plugin folder; rename
  to `alignPerfGridAlignment` or inline into the perf tile. Remove from
  `gridPlacement.ts`'s public API.
- **P2.7** Replace `onPerfTileGridHint` (extracted in P1.1) with
  `registry.get(pluginId)?.gridPolicy?.onHint` — the "RAM only grows" rule
  lives in perf's registration.
- **P2.8** Convert `PerfOptionsForm.svelte` (from P1.4) into a per-plugin
  settings fragment: the registration exposes a `settings` component used
  by `TileSettingsOverlay`. Overlay stops branching on pluginId.
- **P2.9** Flip `check:ui-plugin-guard` to **blocking** in CI. From now on,
  no pluginId literal may exist outside `lib/plugins/` or a small allow-list
  (registry file + tests).

**Done when:**

- `grep -R "pluginId === \"" apps/ui/src --exclude-dir=plugins
  --exclude-dir=__tests__ --exclude-dir=tests` returns 0 matches (guard is
  blocking).
- `DashboardHost.svelte` has no plugin-id literals; `gridPlacement.ts` has no
  plugin-id literals.
- `CpuTile.svelte`, `RamTile.svelte`, `NwTile.svelte`, `DiskTile.svelte`,
  `DhcpPoolsTile.svelte`, `DhcpClientsTile.svelte`,
  `DhcpReservationsTile.svelte` are deleted (behaviour preserved via
  `DataTableTile` + perf registrations).
- `TileSettingsOverlay.svelte` ≤ 220 lines; perf option fields live entirely
  in `lib/plugins/perf/PerfOptionsForm.svelte`.
- Vitest: new tests for `ManifestRegistry`, `PluginTileMount` (unknown and
  throwing plugin cases), `DataTableTile`.
- Playwright unchanged.

**Risk:** Medium. `PluginTileMount` is new orchestration; cover with
Vitest first. `DataTableTile` absorbing three tiles is the biggest diff;
screenshot-compare against P0.1 baselines.

**Doc work:** ADR **ADR-0048: Operator dashboard plugin registry** records
the runtime contract; `dashboard-plugin-blueprint.md` gets a new
"Implementation snapshot" paragraph pointing at the registry + mount.
`specs/contracts/ui_dashboard_plugin.py` is expanded from stub to carry the
manifest fields we actually use.

---

## Phase 3 — LayoutStore + network edge (2 days)

**Goal:** pull the layout state out of `App.svelte`, add proper debounce +
error surfacing on save, make the server/localStorage precedence explicit,
and run Zod at runtime.

**Changes:**

- **P3.1** Create `apps/ui/src/lib/dashboard/layoutStore.ts` matching the
  interface in `UI_ENGINE_SPEC.md` §3.2. Implement as a plain TS class with
  Svelte 5 `$state`/`writable`-style stores; hydrate from
  `gateway.getDashboardLayout` with localStorage fallback and a
  `source: "server" | "cache"` flag.
- **P3.2** Extend `DataGateway.putDashboardLayout` with a **debounce
  wrapper** in the store (400 ms). Store exposes `flush(): Promise<void>`;
  `DashboardPage.endEdit`, hash route change, and `beforeunload` call
  `flush`.
- **P3.3** Remove `.catch(() => {})` from `putDashboardLayout` call. On
  failure, surface via `loadError` in the store and a Flowbite toast. Add a
  status badge in `App.svelte` chrome when `source === "cache"` or PUT is
  failing.
- **P3.4** Introduce runtime Zod on `DataGateway` responses. Reuse
  `apps/ui/src/lib/api/openapiZod.ts`. On parse failure: log, throw a
  typed `GatewayError`, and let the caller decide (store hydrates from
  cache; tiles render a fallback). Tests: add a Vitest that a malformed mock
  response triggers the correct fallback.
- **P3.5** Replace hand-rolled `parseDashboardLayout` in `layoutStorage.ts`
  with a Zod schema derived from `specs/dashboard/layout.schema.json` (or
  hand-mirrored and cross-checked by a one-time `openapiZod` test). The
  perf-specific `tile.options` validator in `isTileOptions` becomes a
  `z.union()` assembled from each registered plugin's `optionsSchema` at
  boot.
- **P3.6** Move the legacy `perf.summary` strip logic in
  `initialDashboardLayout()` / `mergeMissingDefaultPlugins()` into a named
  migration step (e.g. `migrations/2026-04-removeLegacyPerfSummary.ts`)
  addressable by payload version. Keep behaviour identical.
- **P3.7** Forward compat: accept `version > 2` loads by looking up a
  registered migration. If none, surface a clear error and keep localStorage
  read-only until resolved — do **not** silently fall back to cache.

**Done when:**

- `App.svelte` ≤ 130 lines; nearly all imperative layout glue now lives in
  `layoutStore.ts`, `overlayActions.ts`, `dashboardBootstrap.ts`.
- Vitest: layoutStore unit tests cover load precedence, debounce-on-save,
  flush-on-exit, reset, Zod failure.
- Running the dev UI with the mock server offline shows a "cache" badge and
  read-only mode (no silent writes).
- Flipping a tile option triggers one PUT 400 ms later, not one per
  keystroke.

**Risk:** Medium. Debouncing shifts timing of server writes; cover with both
unit tests (fake timers) and a Playwright test that toggles a setting and
checks network activity.

**Doc work:** Update `dashboard-plugin-blueprint.md` §"Tile settings in edit
mode" — the claim that PUT is debounced is **already in the doc**; this
phase brings the code up to the doc's claim.

---

## Phase 4 — Host Controls + Fault Isolation (2 days)

**Goal:** make `tile.hostControl` and `tile.displayMode` real, and isolate
faults per the blueprint's fault-isolation requirements.

**Changes:**

- **P4.1** Implement `TileErrorBoundary.svelte` (per spec §3.5) and
  `TileFallback.svelte`. Wrap `<PluginTileMount/>` with the boundary.
  Unknown pluginId → fallback; thrown error → fallback with details (hidden
  behind a "Show details" disclosure for prod, shown inline in dev).
- **P4.2** Honour `manifest.enabled === false`: boundary renders a
  `reason: "disabled"` fallback with a link to Admin.
- **P4.3** Implement `SinglePanelHost` as a pass-through wrapper (what we
  have today, just named). Implement `TabControlHost` for real — it reads
  `tile.children[]` or a sibling group's children (clarify via ADR). If
  scope is too big, ship it as a named placeholder (`reason:
  "host-control-not-implemented"`) so the wire contract stops lying.
- **P4.4** Decide `vertical-stack` and `split-grid` posture: either
  implement with the same shape as `tab-control`, or lower the blueprint's
  claim ("v1 ships single-panel + tab-control; vstack + split-grid are
  future-considered") via an ADR amendment. Pick one; do not leave them as
  silent single-panels.
- **P4.5** Make each plugin actually honour `displayMode`. At minimum:
  - `dhcp.clients` already honours `compact`; keep.
  - `dhcp.pools`, `dhcp.reservations`, `discovery.records`: ship a compact
    variant (e.g. row count + "N items" summary). Behaviour change is
    intentional and documented.
  - `perf.*`: either map `compact` → `display_style: "percent_only"`
    automatically, or declare `supports_compact: false` in the manifest so
    the overlay hides the toggle.
- **P4.6** Overlay dynamically hides `displayMode` / `allowed_host_controls`
  fields when the manifest declares `supports_compact: false` / a single
  host control. Already partly true in code, verify and test.

**Done when:**

- A plugin that throws at render does not break sibling tiles (Vitest +
  Playwright).
- An unknown pluginId renders a friendly fallback with a recovery action.
- `hostControl` and `displayMode` either do something observable or are
  correctly hidden from the overlay.

**Risk:** Medium. Host controls are a surface area expansion; scope to two
(`single-panel`, `tab-control`) and put the others behind a placeholder if
time is short.

**Doc work:** ADR **ADR-0049: Operator dashboard fault isolation and host
control scope for v1**. Update blueprint §"Fault isolation" to cross-link
the new components.

---

## Phase 5 — EventBus + shared primitives (1 day)

**Goal:** SSE fan-out via a bus; shared **atoms** and **plugin families**
(gauge layout, table shell) so perf-style and table-style plugins share
behaviour without copying Card+Table boilerplate. See
[`UI_ENGINE_SPEC.md`](UI_ENGINE_SPEC.md) §5.2 Layer B/C.

**Changes:**

- **P5.1** Create `lib/dashboard/eventBus.ts`. One `EventSource`;
  `subscribe(topic, selector, onValue)`; `connectionState` readable.
- **P5.2** Move the SSE `onMount` block out of `App.svelte` into the bus.
  `liveCpuPercent` becomes `bus.subscribe("fabric.perf.updated", picker,
  ...)` inside the perf registration's `dataHook`.
- **P5.3** Promote `SemicircleGauge.svelte` + `gaugeMath` + `gaugeThresholds`
  to a general-purpose primitive. No longer only used by perf. Add a story
  / usage doc (MDX or markdown) under
  `docs/operator/` describing plugin primitive usage.
- **P5.4** Introduce **`GaugeTileLayout`** (or equivalent): title/toolbar slot,
  responsive gauge grid / metric-list mode, alignment + `hint()` wiring —
  refactor `PerfTile` / `PerfMetricTile` to consume it so new gauge-class
  plugins only supply data + options.
- **P5.5** Introduce **`TablePluginShell`**: column defs, compact column
  hiding, optional **client pagination** first; leave hooks for **server
  paging** (`page`, `pageSize`, `total`, `onPageChange`) and optional **edit**
  (row actions, `onSave` / modal slot) so reservations / static leases can
  grow into it without a second table implementation. Factor DHCP list plugins
  to adapters on this shell.
- **P5.6** Factor `MetricList.svelte` for `display_style: "percent_only"`
  views; gauge family consumes it instead of perf duplicating markup.

**Done when:**

- `App.svelte` does not import `subscribeFabricEvents` directly.
- `SemicircleGauge` has a consumer other than perf (even a demo storybook
  page suffices for v1).
- **Gauge family** and **table family** each have one non-perf consumer or a
  documented demo route so the abstractions stay honest.
- A CI check (or lint rule) prevents plugins from importing anything under
  `lib/dashboard/` except the public `types` barrel and `eventBus`.

**Risk:** Low-Medium. Bus change is additive; the guardrail on plugin
imports is the highest-risk item because it may catch existing leaks.

**Doc work:** Update `docs/architecture/events.md` if needed;
`dashboard-plugin-blueprint.md` gains a new §"Plugin primitives" cross-ref.

---

## Phase 6 — Shell + routing polish (½ day)

**Goal:** reduce `App.svelte` to the kernel-only shell per the spec's ≤ 120
line target.

**Changes:**

- **P6.1** Move `DashboardPage.svelte` into `lib/dashboard/DashboardPage.svelte`.
  It owns editor open/close, overlay state, palette drop wiring, and mounts
  `DashboardHost`. `App.svelte` picks between `DashboardPage` and
  `AdminPage`.
- **P6.2** Move `ThemeControls` visibility logic for accent into the
  dashboard page (it's dashboard-editor-only). `App.svelte` renders
  `ThemeControls` unconditionally for mode + preset.
- **P6.3** Extract header chrome into `<ShellHeader/>`: branding,
  `ThemeControls`, dashboard mode toolbar, admin link.

**Done when:**

- `App.svelte` ≤ 120 lines and contains only: route state, shell header
  mount, page switch, top-level error boundary.

**Risk:** Low. All Svelte file moves; behaviour stays identical.

---

## Phase 7 — Test coverage hardening (parallel, ~1 day)

**Goal:** lock the new abstractions with coverage so regressions are hard.

**Changes:**

- **P7.1** Vitest for `LayoutStore` precedence + debounce + flush (fake
  timers).
- **P7.2** Vitest for `ManifestRegistry`: register / resolve / unknown.
- **P7.3** Vitest for `TileErrorBoundary`: throws, unknown id, disabled.
- **P7.4** Vitest for `EventBus`: reconnect, selector, unsubscribe.
- **P7.5** Vitest for every plugin's `optionsSchema` (one file per plugin
  folder).
- **P7.6** Playwright: add a "plugin author" spec that adds a throwing fake
  plugin via a test-only registration and verifies neighbouring tiles still
  render.
- **P7.7** Playwright: render-parity spec — same layout JSON in read mode
  and edit mode produces the same tile positions (by data-testid) within
  tolerance.

**Done when:**

- Line coverage ≥ blueprint target (100% target / 99% floor on the new
  engine surface per `docs/architecture/testing.md`).

**Risk:** Near zero; tests only.

---

## Phase 8 — Cleanup + doc promotion (½ day)

**Goal:** close the loop.

**Changes:**

- **P8.1** Retire `rowPanelLayout.ts` as a standalone concept; fold it into
  a one-shot migration helper next to other migrations from P3.6.
- **P8.2** Decide the fate of `apps/ui/src/mock/routes.ts` alias (delete;
  update any test imports — already done in P1.6 but verify).
- **P8.3** Update `docs/architecture/dashboard-plugin-blueprint.md`:
  - Replace the "Implementation snapshot (shell)" bullets with links to the
    new registry + store + host controls.
  - Add §"Plugin contract (runtime)" with the TS types from spec §5.1 as
    an informative block.
- **P8.4** Write ADR-0048 (registry), ADR-0049 (fault isolation + host
  control scope). If `tab-control` shipped only as a placeholder, record
  that decision and the re-entry criteria per
  `.cursor/rules/adr.mdc`.
- **P8.5** Expand `specs/contracts/ui_dashboard_plugin.py` from stub to
  carry the manifest fields we actually use (`allowed_host_controls`,
  `supports_compact`, …). Keep it aligned with the OpenAPI schema.
- **P8.6** Move `UI_ENGINE_REVIEW.md`, `UI_ENGINE_SPEC.md`, and
  `UI_ENGINE_PLAN.md` either (a) into `docs/planning/` with a clear "not
  Accepted" banner, or (b) fold their contents into
  `dashboard-plugin-blueprint.md` and delete the working copies. Decide
  with the human.

**Done when:**

- No leftover "TODO(P-*)" markers in code from earlier phases.
- ADRs accepted (self-review per `commits.mdc`).
- `dashboard-plugin-blueprint.md` Change Log updated.

**Risk:** None for code; doc-gate rigor applies.

---

## Timeline (indicative, for a solo maintainer)

| Phase | Estimate | Dependency |
|---|---|---|
| P0 Safety net | 0.5 d | - |
| P1 Mechanical decomposition | 1 d | P0 |
| P2 Registry + plugin mount | 2–3 d | P1 |
| P3 LayoutStore + network edge | 2 d | P2 (for options schema source) |
| P4 Host controls + fault isolation | 2 d | P2, P3 |
| P5 EventBus + primitives | 1 d | P2, P4 |
| P6 Shell polish | 0.5 d | P3, P4, P5 |
| P7 Test hardening | 1 d | parallel with P3–P6 |
| P8 Cleanup + docs | 0.5 d | all |

Total: **~10 days** of focused work. Realistically ship over 3–4 weeks with
normal CI/doc overhead and review.

---

## What this plan intentionally does not do

- **No rewrite of `gridPlacement.ts`.** It's the strongest file. Only
  extract plugin literals.
- **No swap of the component library.** ADR-0046 (Flowbite Svelte v2 +
  Tailwind v4) holds.
- **No change to the wire contracts** (`specs/api/openapi.yaml`,
  `specs/dashboard/layout.schema.json`). If the plan needs a schema change,
  it's out of scope and becomes an ADR of its own.
- **No new product features.** No new plugins, no new host controls beyond
  what the blueprint already declares, no new admin surfaces.
- **No introduction of SvelteKit, Router, or a state library** (Pinia/etc.).
  The stores defined here are plain Svelte 5 stores.

---

## Success metric (one number)

> Adding a new built-in plugin (e.g. `audit.log`) requires **one new folder
> under `apps/ui/src/lib/plugins/`, zero edits in `apps/ui/src/lib/dashboard/`,
> and zero edits in `apps/ui/src/App.svelte`.**

If that is true at the end of Phase 5, the engine / plugin boundary is
healthy and the rest of the plan is polish.

---

## Follow-ups (not in this plan's scope)

- Marketplace & external plugin bundles — `docs/architecture/marketplace.md`.
- Iframe embed auth hardening (`eab` token flow) beyond the current
  blueprint.
- Multi-dashboard support (`"default"` is currently the only id).
- Collaborative editing / CRDTs instead of last-write-wins.
- Visual regression tests with `Playwright --update-snapshots` for theme +
  layout combinations.
