# UI plugin branch — progress tracker

**Branch:** `plugin`  
**Plan:** [.cursor/plans/ui-v2-plugin-branch.plan.md](../../.cursor/plans/ui-v2-plugin-branch.plan.md) (read-only reference; do not edit as part of routine work)

## Current focus — Phases 2 + 7 closed; rolling verification

**Phase 2 (v3 nested groups)** and **Phase 7 (editor DnD UX)** are **done** on this branch. **Remaining:** align [`dashboard-plugin-blueprint.md`](../architecture/dashboard-plugin-blueprint.md) or a short ADR only if a **new** host or persistence contract diverges from what the code already implements. Phase 0 baseline checklist: **signed off** (manual verification on `plugin`).

## Before (frozen @ branch cut)

- **Palette:** flat edit-mode buttons inside `DashboardHost`; drag uses MIME + `text/plain` prefixes (`x-kea-fabric:plugin:…`, add-group tokens); `PaletteDrag` union is plugin vs group only.
- **DnD:** `svelte-dnd-action` root + per-group zones; cross-zone moves; limited structured “drag intent” documentation.
- **Nesting:** one level — `DashboardGroup.children` are tiles only (`DashboardTile[]`).
- **Layout load/save/migrate:** spread across `appMount.ts`, `dashboardBootstrap.ts`, `layoutStore.ts`, `layoutStorage.ts`, `layoutTree.ts` (`migrateV1ToV2` / `ensureLayoutV2`), `layoutZod.ts`, `layoutNormalize.ts`, `appDashboardShell.ts`, `ShellHeader.svelte`.
- **Version gate:** `layoutJsonUnsupportedVersionMessage` accepts layout versions **1–2** only in storage parse path.
- **Persistence:** debounced PUT in `layoutStore`; localStorage in `layoutStorage`; server wins on successful GET bootstrap (`acceptServerLayout`).
- **Plugins:** `lib/plugins/registry.ts` resolves built-in tiles; no separate `dashboardTileRegistry` / admin route registry.

### Layer ownership

See plan **Architectural layers** table.

- **Server vs client layout policy:** documented in [`apps/ui/src/lib/dashboard/persistence/hydrateInitial.ts`](../../apps/ui/src/lib/dashboard/persistence/hydrateInitial.ts) (module header: cache vs server baseline, dirty semantics).
- **Undo vs remote refresh:** **(a) clear stacks** — `acceptServerLayout` and compatible server resets call `clearUndoStacks()` in [`layoutStore.ts`](../../apps/ui/src/lib/dashboard/layoutStore.ts); covered in Vitest.

### Phase 0 baseline checklist

Manual unless noted; all should pass on `plugin`.

- [x] App boots (`npm --prefix apps/ui run dev` or production build).
- [x] Dashboard renders with default or cached layout.
- [x] Edit mode: enter/exit editor.
- [x] Add tile (click + drag from palette).
- [x] Add/move container; move tile root ↔ group.
- [x] Tile + group settings overlays open/close.
- [x] Save layout to file; reset baseline; flush on navigate to admin.
- [x] Disabled / unknown plugin / invalid options → fallbacks (no hard crash).

**Automated verification on branch:** `bash scripts/check_app.sh`; `npm run check:ui-unit` (100% line coverage on enforced UI paths).

**Phase 0 integration commit (this branch):** run `git log -1` on `plugin` (integration landed as a single signed commit).

---

## Target (end state)

- First-class **migration** + **persistence** modules; thin shell/bootstrap.
- **v3** recursive groups; schema + OpenAPI + Python validator aligned (**Phase 2 — done;** see Phase 2 row).
- Unified **palette** (plugins + core) with codec + PluginPalette UI + polish.
- **Editor** toolbar + inspector; **DnD** interaction layer; **undo/redo** with documented remote rules.
- **dashboardTileRegistry** + lint boundaries; **adminRouteRegistry** + engine public API doc.

---

## After (when `plugin` merges)

_Update once merge to `main` is done._

---

## Phase 0 — Branch, baseline, progress skeleton

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | Branch `plugin`; this progress file; [`featureFlags.ts`](../../apps/ui/src/lib/platform/featureFlags.ts) with `ui.palette.v2` (default on branch), `ui.drag.enhanced`, `ui.registry.v2`; Vitest for flags. |
| **Remaining** | Optional Playwright extensions. |
| **Verification** | `bash scripts/check_app.sh`; `npm run check:ui-unit` |
| **Notes / risks** | — |

---

## Phase 1 — Persistence + migration modules

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | [`migration/`](../../apps/ui/src/lib/dashboard/migration/) (`layoutUpgrade`, golden fixture + test); [`persistence/`](../../apps/ui/src/lib/dashboard/persistence/) (`hydrateInitial`, `remoteLayout`); slim [`layoutStorage.ts`](../../apps/ui/src/lib/dashboard/layoutStorage.ts); `layoutStore` / callers wired; `layoutCompare` / `layoutDedupe` split. |
| **Remaining** | — |
| **Verification** | `bash scripts/check_app.sh`; `npm run check:ui-unit` |
| **Notes / risks** | No intentional UX change beyond modularization. |

### Phase 1 inventory (file → responsibility → module)

| File | Responsibility | Target module |
| --- | --- | --- |
| `layoutTree.ts` | re-exports migration + dedupe | `dashboard/migration/`, `layoutDedupe` |
| `layoutStorage.ts` | key + parse gate + download helpers | `persistence` + thin storage |
| `layoutStore.ts` | orchestration | unchanged surface |
| `dashboardBootstrap.ts` | server GET path | uses persistence hydrate |
| `migrations/stripLegacyPerfSummary.ts` | tile-level strip | imports `ensureLayoutV2` from `migration/` |

---

## Phase 2 — Nested containers (v3)

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | Recursive `GroupChild` / v3 layout types + Zod + normalize; `migrateV2ToV3` + golden fixtures + `layout_validate.py` + `specs/dashboard/layout.schema.json` + OpenAPI; `layoutJsonUnsupportedVersionMessage` for v3; nested read host (`DashboardReadNestedHost`, no deprecated `<svelte:self>`); `DashboardHost` + `gridPlacement` / DnD / `layoutTree` / `groupDndFinalize` / undo paths for nested groups; Vitest coverage on enforced paths for migration, strip-legacy, placement, Zod, layout store cap; Playwright `dashboardNested.e2e.ts` (seeded v3 nested layout) + e2e fixture helpers; persisted layout version **3** in parent-move spec. |
| **Remaining** | Optional blueprint touch-up if reviewers want prose parity with shipped behaviour. |
| **Verification** | `bash scripts/check_app.sh`; `npm run check:ui-unit`; `npm run check:ui-e2e` |
| **Notes / risks** | Plugin isolation e2e expects `VITE_E2E_THROWING=1` (Playwright `webServer` sets it). With `PW_REUSE_DEV_SERVER=1`, start the same dev command with that env or the spec **skips** after probing `globalThis.__KEA_FABRIC_E2E_THROWING`. Palette e2e accepts both legacy and `ui.palette.v2` test ids. |

---

## Phase 3 — Palette model

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | [`lib/palette/types.ts`](../../apps/ui/src/lib/palette/types.ts), `paletteCatalog.ts`, `paletteDragCodec.ts` (`parsePaletteDrop`), tests. |
| **Remaining** | — |
| **Verification** | `npm run check:ui-unit` |

---

## Phase 4 — PluginPalette UI

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | `PluginPalette.svelte` + tests; `DashboardHost` swaps palette on `ui.palette.v2`; core + plugin chips; drops via codec. |
| **Remaining** | — |
| **Verification** | `npm run check:ui-unit` |

---

## Phase 5 — Palette polish

| Field | Content |
| --- | --- |
| **Status** | done (MVP) |
| **Done** | `paletteStorage.ts` + tests; PluginPalette a11y basics; pinned/recent hooks where implemented in palette module. |
| **Remaining** | Full keyboard parity, duplicate-name disambiguation, extended empty states — ticket if needed. |
| **Verification** | `npm run check:ui-unit` |

---

## Phase 6 — Toolbar + inspector

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | `editor/editorState.ts`, `DashboardToolbar.svelte`, `InspectorPanel.svelte`; `DashboardPage` three-column layout; overlays coexist; selection wired. |
| **Remaining** | Optional: migrate remaining chrome copy from `ShellHeader` per taste. |
| **Verification** | `npm run check:ui-unit` |

---

## Phase 7 — DnD UX

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | `interactions/dragIntent.ts` + `DASHBOARD_DRAG_INTENT_KINDS` + unit test; **`interactions/dndEditorFeedback.ts`** + tests — shared **`dropTargetStyle`** (dashed primary outline) on all editor `dragHandleZone`s; root **FLIP** **180 ms** with **`prefers-reduced-motion: reduce` → 0 ms**; nested zones **0 ms** flip; **`transformDraggedElement`** lift (opacity + shadow, motion-safe); **`data-editor-pointer-dnd`** on editor chrome during pointer consider…finalize; Playwright `editor pointer drag toggles chrome DnD active flag`. **Snap preview:** svelte-dnd **shadow placeholder** item is the live reorder preview (no separate overlay). **Deferred (profiling / product):** rAF-throttled consider batches, invalid-cross-zone chrome, ARIA live slot announcements. |
| **Remaining** | — |
| **Verification** | `npm run check:ui-unit`; `npm run check:ui-e2e` |

### Drag intent → drop target (v3 editor)

| Intent (`dragIntent.ts`) | Primary interaction | Valid drop targets (editor) |
| --- | --- | --- |
| `palette-plugin` | Palette / codec drag | Root `dragHandleZone`, group HTML5 `ondrop` (inner grid / nowrap strip), canvas chrome |
| `palette-core` (`add-group`) | Add container chip | Root grid / canvas (native drop) |
| `grid-tile` | Grip on tile | Any `dragHandleZone` of type `dashboard-layout` (root ↔ group ↔ nested group strip) |
| `grid-group` | Grip on container | Same `dashboard-layout` **dragHandleZone** regions as tiles (root + per-group lists); structure updates go through `groupDndFinalize` / layout store. |

Placement semantics are unchanged; this table is for UX and host wiring (see Phase 7 **Done** for shipped feedback layers).

---

## Phase 8 — Undo / redo

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | `layoutStore` undo/redo stacks; `clearUndoStacks` on `acceptServerLayout`; `skipHistory` on reset paths; toolbar Undo/Redo; Vitest including `canUndo` / `canRedo` / empty-stack safety. |
| **Remaining** | Optional: dedicated `editorHistory.ts` file if the store should shrink further. |
| **Verification** | `npm run check:ui-unit` |

---

## Phase 9 — Tile registry + plugin bases

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | [`dashboardTileRegistry.ts`](../../apps/ui/src/lib/platform/extensions/dashboardTileRegistry.ts); `PluginTileMount` resolves via registry; [`PLUGIN_AUTHORING.md`](./PLUGIN_AUTHORING.md); Vitest. |
| **Remaining** | Optional eslint import boundaries for `lib/plugins/*` → engine (plan §Phase 9). |
| **Verification** | `npm run check:ui-unit` |

---

## Phase 10 — Admin registry + engine API doc

| Field | Content |
| --- | --- |
| **Status** | done |
| **Done** | `adminRouteRegistry.ts`, `AdminRegistrySamplePage.svelte`, `AdminPage` registry resolution + `#/admin/ext/sample`; [`DASHBOARD_ENGINE_PUBLIC_API.md`](./DASHBOARD_ENGINE_PUBLIC_API.md); Vitest for registry + `AdminPage`. |
| **Remaining** | — |
| **Verification** | `npm run check:ui-unit` |
