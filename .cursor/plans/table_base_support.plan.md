# `BaseDataTable`: paging, header, sort, filter, modal, edit (base primitive)

**Status:** plan — not yet implemented  
**Primary name:** **`BaseDataTable`** (Svelte component). Types: **`BaseDataTableSettings`**, **`BaseDataTableColumn`**. Replaces/extends the existing [`TablePluginShell`](apps/ui/src/lib/components/TablePluginShell.svelte) — refactor into (or supersede with) [`BaseDataTable.svelte`](apps/ui/src/lib/components/BaseDataTable.svelte) and [`baseDataTable.ts`](apps/ui/src/lib/components/baseDataTable.ts) on branch **`table`**.

**Delivery:** All implementation for this plan is done on a dedicated git branch **`table`** (merge to `main` only after review, CI green, and acceptance). **Testing is a first-class requirement:** high coverage on pure helpers, focused Svelte/component tests for the shell and modal, and Playwright coverage for critical paths (see **Tests**); optional **axe** in CI as a stretch.

**Scope note:** A concrete product screen may show **dense, many-column** tables with rich cells (icons, multi-line “Services”, blended status+icons, etc.). That **domain content** is **out of scope for the base primitive** — the plugin or a thin adapter owns column definitions and, where needed, **per-column snippets** or custom cell components. The base work is **mechanics** (layout, paging, sort/filter/export, modal shell) **plus** the **Pro-level bar** (theme, validation, error handling, dropdowns) — all **as specified below**, so the result is shippable product quality, not a demo. A reference example (e.g. DHCP clients with 10+ columns) informs **density** and **header sort affordances**, not a requirement to implement every custom cell type in the shared shell.

**Resolved TBDs (from clarification — 2026):** Unresolved choices used **“Don’t know — defer to first PR on `table`”** as an option; the following are **locked** for v1.

| Topic | Decision |
|--------|-----------|
| **Rich cells** | **Svelte 5 `Snippet` per column** (e.g. `cell?: Snippet<[row]>`); **BaseDataTable** owns `<td>` wrapper only; no `svelte:component` in v1 unless a later ADR extends. |
| **Modal row set** | **Match the tile:** same **filter + sort** as the tile, **all** rows that match, **no paging** in the modal. Parent still passes the full `items` if the tile needs to re-derive. |
| **Save contract** | **Per row:** `onCommit({ rowId, patch })` (or `Promise`) — one logical commit per changed row; parent may batch to the gateway. No “replace whole array” in the base contract for v1. |
| **Zod + `validate()`** | **Zod first** (row or column schema if supplied), then column **`validate()`** for additional / custom messages. |
| **Open modal** | **Explicit control only** (e.g. “View all” / expand) — **no** whole-card / table-surface click to open. |
| **Export extras** | **UTF-8 BOM on CSV** (Excel-friendly), sensible **ISO-style filename** with timestamp, **JSON pretty-print default: on** (readable downloads). |

*Clarification: each topic offered a **“Don’t know — decide during first PR on `table`”** option; the table records the options that were **chosen** (not deferred).*

## Goals

- Reusable table chrome **independent of data source** (plugin passes columns + items + callbacks).
- Optional **client-side paging** with page size from container height and/or a cap.
- **Header does not scroll away** with body content (layout + sticky / split thead-tbody as needed).
- **Header-click sorting** and **filtering** (client-side, on the in-memory row set for the tile and modal).
- **Modal** from the tile with **all** rows; **editable** cells driven by **column metadata** + per-row `onCommit` / gateway wiring, gated by **`allowEdit`** (and related flags).
- **UX states** (loading, error+retry, empty) as first-class in **BaseDataTable**.
- **Export:** download current data as **CSV** and as **JSON** (see below); available from the table toolbar and/or modal.
- **Accessibility (required):** not an afterthought — tables, toolbars, paging, sort controls, filter field, and modal must meet baseline WCAG-oriented behavior (see **Accessibility** section).
- **Pro-level bar (required):** **Theme** integration (light/dark, Flowbite design tokens, no hard-coded light-only grays in core chrome), first-class **validation** for edited fields, systematic **error handling** (load vs save vs field vs network; never silent), and **dropdown / select** support for enums and similar columns — see **Pro-level bar** below.
- **Feature flags (required):** Every major behavior is **configurable** via **`BaseDataTableSettings`** (or equivalent props) so plugins and tile options can turn capabilities on or off without forking the component — see **Feature flags / `BaseDataTableSettings`** below.

## Feature flags / `BaseDataTableSettings` (required)

All capabilities are **opt-in or opt-out** through explicit **boolean (or enum) settings** passed into `BaseDataTable` (and mirrored on the **modal** where applicable). **Naming in code:** `camelCase` in TypeScript (e.g. `allowSort`); product docs may use **PascalCase** labels (e.g. “AllowSort”) for settings UI parity.

| Setting (logical name) | TypeScript prop (illustrative) | Default (v1 proposal) | When `false` / disabled |
|------------------------|--------------------------------|------------------------|-------------------------|
| Allow sort | `allowSort` | `true` | No sort on headers; no `aria-sort` / no sort chevrons; per-column `sortable` is ignored. |
| Allow filtering | `allowFilter` (or `allowFiltering`) | `true` | Hide global (and per-column) filter UI; data shows unfiltered (or use parent-filtered `items` only). |
| Fixed header (sticky) | `fixedHeader` | `true` | When the table body scrolls or pages, `thead` stays visible as today; if `false`, document behavior: **scroll entire table** including header, or no inner scroll (pick one in impl.; prefer “no sticky” class only). |
| Client paging | `allowPaging` | `true` | No page controls; show all **tile** rows in one scroller (subject to max height) or a single “window” per layout rules. |
| Auto page size | `autoPageSize` | `true` (when `allowPaging`) | N/A when paging off. |
| Export CSV | `allowExportCsv` | `true` | Hide **Export CSV** button. |
| Export JSON | `allowExportJson` | `true` | Hide **Export JSON** button. |
| Open full modal | `allowModal` (or `showViewAllButton`) | `true` | Hide “View all” / expand; no modal for this instance. |
| Manual refresh | `allowRefresh` | `false` or `true` (product pick) | Hide refresh in toolbar. |
| Edit in modal | `allowEdit` | `true` | Modal is **read-only**; no inline inputs; **Save** hidden or disabled. |
| Themed / error chrome | (always on) | — | Theme and load/save error regions remain unless the whole tile is replaced. |

**Rules:**

- **Composition with column metadata:** Effective sortability = `allowSort && (col.sortable !== false)` (exact rule TBD: default `sortable` true for data columns). Effective filter participation = `allowFilter && col.filterable !== false` for global search.
- **Persisted options:** For dashboard tiles, flags may map from **`tile.options`** in Zod (e.g. `table_allow_sort`, or nested `table: { allowSort, … }`) — add fields to [tileOptionsZod](apps/ui/src/lib/plugins/tileOptionsZod.ts) for plugins that use `DataTableTile`; the plugin passes the resolved object into **BaseDataTable** as `settings`.
- **Tests:** Matrix or table-driven tests for **at least** `allowSort`, `allowFilter`, `fixedHeader`, `allowPaging`, `allowModal`, `allowEdit` (UI hidden; no spurious a11y roles).
- **Defaults:** ship **permissive defaults** (`true` for most features) so existing tiles behave “fully featured” unless options restrict them; document in UI ENGINE spec.

## Pro-level bar (required — not optional polish)

### Theme support

- **Use the app’s existing stack:** [app.css](apps/ui/src/app.css) variables, `class="dark"` on `html`, **Tailwind v4** `dark:` utilities — align with [ThemeControls](apps/ui/src/lib/theme/ThemeControls.svelte) / Flowbite usage elsewhere; **no** one-off light-mode-only table styling in the base shell.
- **Table chrome:** border, background, and **sticky** `thead` use **opaque** backgrounds (`bg-white` / `dark:bg-gray-800` or design tokens) so body rows do not “show through” the header on scroll. Hover/focus rings match the rest of the admin UI.
- **States in-theme:** error text (`text-red-600 dark:text-red-400` pattern), **disabled** toolbars, skeleton loaders that work in both modes.
- **Optional:** a small BEM or `data-table-*` class namespace in `app.css` for shared table **focus** and **row hover** if Tailwind classes become unwieldy — keep tokens centralized.

### Validation

- **Column metadata** must support at least: **`validate?: (value: unknown, row: unknown) => string | null`**, and/or **optional** Zod (column or row) from the plugin. **Order of execution (v1, locked):** run **Zod first**, then **column `validate()`** (see **Resolved TBDs**).
- **Modal (and any inline edit later):** show **per-field** errors under the control; set **`aria-invalid`**, **`aria-describedby`** to the error element id. **Block primary Save** (or show summary) when any field in the dirty set is invalid — no silent drop of bad data.
- **Pure helpers** for “validate all dirty fields” are **unit-tested** with good/bad cases; invalid paths are as important as happy paths in coverage.

### Error handling (systematic)

- **Categories (user-visible, distinct copy where useful):** (1) **initial / refresh load** (table or modal data), (2) **save / commit** (`onCommit` or gateway rejection), (3) **field validation** (above), (4) **transient client** (e.g. export failure, rare parser errors). **No silent failures** — if the user clicked something, they get feedback or a logged dev-only assert in test.
- **Surface:** table-level **error banner** + **Retry** for load; **modal** dedicated error region (and inline field errors) for save/validation; **in-flight** disable on Save and no double submit.
- **Plugin maps** HTTP / gateway errors to **short** messages; optional `onError` callback for toast/logging — shell stays presentation-focused.

### Dropdowns and select controls

- **Editable enum-like columns** use `editor: 'select'` (name can be `dropdown` in docs) with **`options: { value: string; label: string; disabled?: boolean }[]`**, optional **`placeholder`**, optional **empty** option for nullable fields (`value: ''` with clear label).
- **Implementation:** **Flowbite-Svelte** `Select` (or `Input`+native `<select>` with the same **themed** classes) — must match **keyboard** and **a11y** (label, `id`, error association).
- **Optional later:** per-column **filter** as a dropdown (e.g. “Status = Active”) in the toolbar; same `options` shape. Not required to ship the first shell drop if a global text filter is enough, but the **types** and **theming** must support it without a breaking change.
- **Export:** selected value exports as **value** (or configurable `exportValue` if display ≠ stored value).

## Non-goals (explicit)

- **Virtualization / windowing** — out of scope. Product assumes **row counts stay modest**; render full lists in tile and modal without perf-driven complexity.
- **Server-driven paging / sort** in v1 (optional follow-up when APIs expose `page`, `sort`, `filter` query params).
- **i18n** (translated copy), column resize, bulk row selection — future.

## Column metadata (`BaseDataTableColumn` extensions)

- Existing: `header`, `accessor`, `hideWhenCompact`, `cellClass`.
- **Rich cells (plugin-owned):** optional per-column **Svelte 5 `Snippet`** (see **Resolved TBDs**) so type icons, multi-line lists, and badges are not forced into `accessor(): string` — **base** provides the `td` wrapper; snippet supplies inner content.
- **Sort:** `sortable?: boolean`, `sortKey?: (row) => string | number` (default: string from `accessor`), optional `sortComparator`.
- **Filter:** `filterable?: boolean` — when using per-column filter UI, or participate in a **global filter** (substring match on accessor output for that column if true).
- **Edit (modal):** `fieldKey`, `editable`, `editor: 'text' | 'number' | 'select' | …`, **`options` for `select` (dropdown)** — see **Pro-level bar → Dropdowns**; `placeholder`, `validate` / Zod; optional `getEditValue`/`setValue` for formatted vs raw.
- **Export (optional per column):** `exportable?: boolean` (default: include all visible columns) — if some columns are purely decorative, omit; **JSON** can use `fieldKey` or column `id` as keys; **CSV** uses header text or explicit `exportHeader?: string`.

## Behaviors

### Paging and layout

- **ResizeObserver** (or fixed `pageSize` / `maxRows`) to derive **rows per page** when `autoPageSize` is on.
- **Card structure:** title (+ optional toolbar) **outside** the vertical scroll; only the data region scrolls or pages.
- **With paging on:** table body shows one page; header fixed; page controls in footer; header does not “scroll off” (no whole-card scroll for the table block).
- **With paging off:** optional vertical scroll in tbody only, **thead sticky** (or block-display pattern) so the header does not move when body scrolls.

### Sorting (client)

- Click **header** to cycle: none / asc / desc, or up/down chevrons. Visual indicator for active column + direction.
- **Stable sort** when values tie. Sort applies to the **current filtered** list if filtering is active.

### Filtering (client)

- **Toolbar row** on the shell: e.g. **one global text field** that matches any column whose metadata includes it in a “searchable set”, and/or **simple per-column** filter inputs (product choice: start with **global search** for lowest UI weight).
- **Empty “no matches”** copy distinct from **“no data”** when filters yield zero rows.

### Export (CSV and JSON)

- **Toolbar (and optionally modal footer):** actions **“Export CSV”** and **“Export JSON”** (real `<button type="button">` with **accessible names**; avoid icon-only without `aria-label`).
- **Default row set for export:** the **current working set** as shown to the user — i.e. after **filter** and **sort** (same order as on-screen), so export matches WYSIWYG. Optional prop `exportScope: 'visible' | 'all'` if product wants a second action (“Export all raw rows”); default **`visible`/`working`**.
- **CSV:** UTF-8 with **BOM** for Excel (per **Resolved TBDs**), header row from column `header` / `exportHeader`; cells from `accessor` string or `fieldKey` raw string; **escape** per RFC 4180.
- **JSON:** array of row objects: prefer **`fieldKey` → value** when present; else keyed by safe column id. **Pretty-print** default: **on** (readable file); may add prop to compact later.
- **Implementation:** small pure helpers in e.g. `lib/components/tableExport.ts` (unit-tested).

### Modal

- Open via **explicit control only** (e.g. “View all” / expand) — no whole-card click (**Resolved TBDs**). Meets **Accessibility** requirements below.
- Row set: **same filter + sort as tile**, all matching rows, no paging — **Resolved TBDs**. **no virtualization** in the modal list.
- **Editable** columns per metadata — **text**, **number**, and **select (dropdown)** with `options`; **Validation** and **Error handling (pro)** apply before and during save.
- **Save** strategy: **per-row** `onCommit({ rowId, patch })` (see contract); may queue multiple rows per user action; **dirty** state, confirm-on-close if unsaved.

### UX and states (required)

- **Loading:** skeleton rows or a single loading line in the table area; do not show empty before first load.
- **Error (load):** show message + **Retry** (re-invokes parent `onRetry` / refetch) — part of the broader **Error handling (pro)** model.
- **Empty:** existing `emptyText` when `items.length === 0` and not loading.
- **No matches:** when filter active and slice length 0.
- **Optional refresh** control in shell toolbar; optional subscription to `FABRIC_EVENT_BUS` for “data may have changed” (future hook).

### Accessibility (required)

- **Table semantics:** use `<table>`, `thead` / `tbody` / `th` with **`scope="col"`** on header cells; caption or `aria-labelledby` from card title if the table has no visible caption. **Do not** rely on `div` grids for the primary data table in v1.
- **Sortable headers:** if header is a button, `aria-sort="none" | "ascending" | "descending"`; otherwise associate sort control and announce changes via **`aria-live="polite"`** region (e.g. “Sorted by Subnet, ascending”).
- **Paging:** `aria-label` on prev/next, **`aria-disabled`** when at ends; `aria-live` for page change (“Page 2 of 5”).
- **Filter / search:** `<label for=…>` (visually hidden label acceptable); **`aria-describedby`** if format hints are needed; clear error/match messaging for screen readers when list updates.
- **Modal:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, **initial focus** inside dialog, **Escape** closes, **focus restore** to launcher on close, **Tab** / **Shift+Tab** do not escape the dialog (focus trap) — follow existing app patterns (e.g. [ShellHeader modal](apps/ui/src/lib/dashboard/ShellHeader.svelte), tile overlays).
- **Export:** buttons have visible text or `aria-label`; on success, optional brief **`aria-live`** status (“Download started” / filename) or rely on browser download behavior without silent failure.
- **Keyboard:** table body scrollable region can use **`tabindex="0"`** *only* if needed; prefer natural tab order for toolbar → page controls → focusable content. **Manual testing** or checklist before merge when touching the shell.

### Persistence and API

- **Generic** per-row `onCommit` (see **contract** above) implemented by the plugin; **OpenAPI** today is read-only for DHCP lists — first slice may use **mock in-memory** updates to prove the pipe, then add PATCH in a follow-up.

## Data sources (how loading works without coupling `BaseDataTable`)

**BaseDataTable** does not fetch — it receives **`items`**, **loading / error** flags, and **callbacks** from a parent (plugin tile, story, or test harness). That keeps **layout and behavior** independent of where rows come from.

| Source | Role | Notes |
|--------|------|--------|
| **HTTP / OpenAPI** | **Primary** production path | Parent uses `DataGateway` (or future client) to call REST endpoints; maps JSON to `unknown[]` / typed rows; passes `err` + **Retry** refetch. Sort/filter/export remain **client-side** on the loaded array unless/until server query params exist. |
| **Interim static JSON** | **Dev, demos, fixtures** | Import or `fetch` a **`.json`** file (e.g. under `src/lib/.../fixtures/` or `public/`) for stories, Vitest, or until an API exists. Same props: `items` parsed from JSON; no special case inside `BaseDataTable`. |
| **Mock / MSW / `handleMockApi`** | **Local app + e2e** | Existing mock layer can return list shapes; parent still “loads” then passes `items`. Useful for Playwright and **highly tested** flows without a real backend. |
| **In-memory / generated** | **Unit tests** | Build small row arrays in Vitest to test sort, filter, paging, export — no I/O. |

**Contract (conceptual):** `BaseDataTable` / modal accept **`items: unknown[]`** (or generic `T[]` at the plugin boundary), optional **`loading`**, **`error`**, **`onRetry`**, and **`onCommit: (args: { rowId: string; patch: Record<string, unknown> }) => Promise<void>`** (or sync void) for **per-row** saves per **Resolved TBDs**. The **plugin** chooses the data source and maps API DTOs ↔ table columns (accessors, `fieldKey`, rich cell snippets).

**API as an option:** When REST (or GraphQL later) is available, the **only** change is in the parent adapter — add routes in OpenAPI, `DataGateway` methods, and wire `onMount` / refresh / save. The **`BaseDataTable` props / contract stay stable**.

**Interim JSON file (or suitable):** Any static asset that produces an array of objects is fine; **JSON** is the default interchange. CSV as a **source** is possible (parse to rows) but is secondary to JSON for structured columnar data.

## File touchpoints (implementation)

- [baseDataTable.ts](apps/ui/src/lib/components/baseDataTable.ts) — types **`BaseDataTableSettings`**, **`BaseDataTableColumn`**, **validation**, **editor**, **select options**.
- [BaseDataTable.svelte](apps/ui/src/lib/components/BaseDataTable.svelte) — `settings` prop: **allowSort**, **allowFilter**, **fixedHeader**, **allowPaging**, export/modal/refresh/edit flags; layout, sort/filter, paging, **themed** chrome, states.
- **Editor modal** (e.g. [`BaseDataTableModal.svelte`](apps/ui/src/lib/components/BaseDataTableModal.svelte) or companion name) — Flowbite [Modal](apps/ui/src/lib/dashboard/ShellHeader.svelte) + **Select/Input** for edit + **validation** UI.
- `tableExport.ts` (or `lib/components/table/`) — CSV/JSON builders + tests; optional `tableValidation.ts` for pure validate-row helpers.
- [app.css](apps/ui/src/app.css) — only if shared **table** tokens (focus/hover) are needed for consistency.
- [DataTableTile.svelte](apps/ui/src/lib/plugins/DataTableTile.svelte) — map **`tile.options` → `BaseDataTableSettings`**, wire fetch, error mapping, sort/filter, **per-row** `onCommit`, **gateway**-level errors on save.
- [tileOptionsZod.ts](apps/ui/src/lib/plugins/tileOptionsZod.ts) — optional nested `table: { allowSort, allowFilter, … }` (or flat keys) for plugins using the data-table tile.

## Tests (high bar)

- **Vitest (required, broad):** Pure helpers — `sortRows`, `filterRows`, `paginate`, **CSV/JSON export**, **`validate` / row-validation helpers**, **select value ↔ export** edge cases. Aim for **near-100%** on new `tableExport` / `tableValidation` / table-utility modules; align with repo coverage gates ([testing.mdc](.cursor/rules/testing.mdc), [AGENTS.md](AGENTS.md)).
- **Svelte / Testing Library (required):** `BaseDataTable` + modal — loading, error+retry, empty, no-matches; **feature flags** (e.g. `allowSort` / `allowFilter` / `fixedHeader` / `allowModal` / `allowEdit` off → correct hidden UI and a11y); sort, filter, paging, modal, **text + select** edit, **invalid** + **save failure**; **light + dark** smoke where feasible.
- **Playwright (strongly recommended):** Happy path on **`table`** branch — dashboard table tile (or dedicated test page) with mock data: open modal, export flow, a11y smoke (or **axe** if added).
- **Regression:** Run full **`npm run check:ui-unit`** and **`check:ui-types`** (svelte-check) before merge; extend [ui.yml](.github/workflows/ui.yml) if new steps are required.

**Not acceptable:** Merging **BaseDataTable** with “we’ll add tests later” — new logic lands with tests in the same PR series on branch **`table`**.

## Doc touch-ups

- [UI_ENGINE_SPEC.md](docs/planning/UI_ENGINE_SPEC.md) table family: client-side v1, no virtualization; **feature flags / `BaseDataTableSettings`**; export; **a11y**; **theme**; **validation** and **error** model; **select/dropdown**; point to this plan.

## Gaps and optional follow-ups (not yet fully specified in this plan)

Items **not** in **Resolved TBDs**; address during implementation or a short spec spike.

- **Dirty / unsaved changes:** **Warn on close** (`beforeunload` or in-modal confirm) when the modal has unsaved edits; **Save** button disabled when not dirty; **in-flight** state on save (no double submit).
- **Save failure:** Covered under **Pro-level bar → Error handling**; ensure copy differs from **load** error and from **field validation**.
- **Permission / read-only table:** Optional `readOnly: boolean` or per-column `editable: false` when the user/role has no write access — only touched if the product needs it in v1.
- **Export filename detail:** Use `${slugFromTitle}-${isoTimestamp}.csv` (and `.json`); slug from title — exact formatting can follow **Resolved TBDs** (ISO-style timestamp).
- **Compact mode:** Reconfirm **which columns** are hidden in `compact` and that sort/filter/export **defaults** (e.g. only visible columns in export) stay consistent.
- **Security / XSS:** Keep rendering **string**-bound text in cells/inputs; no `innerHTML` from row data; note in code review for the shell and modal.
- **Automated a11y:** Optional **@axe-core/playwright** (or similar) in CI for the new shell/modal path — the plan requires manual a11y checklist; automation is a stretch.
- **Reduced motion / contrast:** `prefers-reduced-motion` for any modal/skeleton animation; table **contrast** in dark mode (design pass) — overlaps **Theme support**; keep one checklist.

---

## Todos (implementation)

**Branch:** `table` (all items below on this branch unless hotfix).

1. Add **`BaseDataTableSettings`**, extend column types (**select options**, **validate**), loading/error/empty/no-matches.
2. **Theme:** table + modal + toolbar use **light/dark**-safe tokens; **`fixedHeader`** controls sticky `thead` (see feature flags).
3. Refactor card layout + paging + **feature-flagged** toolbar (sort / filter / export / modal / refresh).
4. Client sort (header click) + filter (global and/or per-column, per choice above).
5. **Export CSV/JSON** (`tableExport` helpers + toolbar actions + `exportScope` default).
6. **Modal:** full list, **text/number/select** editors, **validation** + **error handling (save vs field)**; batch save + dirty/confirm; **Accessibility** (sort/paging/modal/invalid fields).
7. Data source wiring: `DataTableTile` + **API** and/or **fixture JSON** + mock; document adapter + **error mapping** in spec note.
8. **Tests** at high bar (see **Tests**); CI green; PR from **`table`** → `main`.
