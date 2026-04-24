> **Planning artifact — not Accepted architecture.** Normative dashboard contracts live in [`dashboard-plugin-blueprint.md`](../architecture/dashboard-plugin-blueprint.md).

# UI Engine Spec — Kea Fabric Operator Shell

Date: 2026-04-23
Status: working document (not yet an Accepted architecture doc).
Companion to [`UI_ENGINE_REVIEW.md`](UI_ENGINE_REVIEW.md) (diagnosis) and
[`UI_ENGINE_PLAN.md`](UI_ENGINE_PLAN.md) (work to get there).

This document describes the operator UI **as an engine** rather than as an
application. The engine has three crisp layers: **Kernel**, **Plugin Host**,
**Plugins**. Everything that looks like "chrome", "layout", "settings",
"theming", "persistence" belongs in Kernel or Host. Everything that looks like
"CPU gauge", "pool table", "discovery toolbar" belongs in a Plugin. The test is
simple: if adding a new plugin requires touching anything outside the Plugin's
own folder, the layer is wrong.

Where this spec contradicts code today, the **code** is wrong — those are the
items in [`UI_ENGINE_PLAN.md`](UI_ENGINE_PLAN.md). Where this spec contradicts
`docs/architecture/dashboard-plugin-blueprint.md`, the **blueprint** wins (it
is Accepted). This doc is meant to be promoted into that blueprint (or a
sibling Tier C doc) once agreed.

---

## 1. Principles

1. **The dashboard is an engine. Plugins are guests.** The Kernel never
   switches on `pluginId`. The Plugin Host does, via a registry.
2. **Data contract first, runtime contract second.** The wire shape
   (`specs/api/openapi.yaml`, `specs/dashboard/layout.schema.json`) is the law;
   runtime types mirror it and are Zod-validated on ingress and on save.
3. **Geometry is pure.** `gridPlacement` is math; it takes no plugin ids and
   emits no plugin-specific policy.
4. **One code path per concept.** Read-view and edit-view share a renderer.
   One strip-width helper. One tile chrome. One overlay dispatcher.
5. **Plugins fail loud in dev, fail safe in prod.** An exception in one tile
   never breaks the dashboard; unknown/disabled plugins render a typed
   placeholder with a recovery action.
6. **Offline-capable, server-authoritative.** Server is source of truth for
   shared state. localStorage is a cache. Conflicts are resolved by
   last-write-wins per blueprint §"State, permissions, and conflicts".

---

## 2. Layered architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        KERNEL (shell)                         │
│  • routing, chrome, theme, toasts, error boundary             │
│  • DataGateway (single HTTP/SSE edge)                         │
│  • LayoutStore (in-memory + cache + server sync)              │
│  • GeometryEngine (pure gridPlacement)                        │
│  • Validation (Zod: ingress, save, layout migrations)         │
│  • ManifestRegistry  (plugin id → manifest + factory)         │
└───────────────────────────────────────────────────────────────┘
                             │  renders
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                       PLUGIN HOST                             │
│  • DashboardPage: composes LayoutStore + ManifestRegistry     │
│  • DashboardHost: grid + DnD + drop targets + per-tile frame  │
│  • HostControls: single-panel / tab / vstack / split          │
│  • SettingsOverlays: generic fields + plugin.settings slot    │
│  • EventBus: typed SSE dispatch (topic → subscribers)         │
└───────────────────────────────────────────────────────────────┘
                             │  mounts
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                          PLUGINS                              │
│  • perf (cpu / ram / network / disk / summary)                │
│  • dhcp (pools / clients / reservations)                      │
│  • discovery (records / scan-toolbar)                         │
│  • future: nebula, marketplace, audit-log, …                  │
│                                                               │
│  Each plugin owns: id, manifest, data hook, view component,   │
│  optional settings fragment, optional compact view.           │
└───────────────────────────────────────────────────────────────┘
```

This is the same vocabulary the Accepted blueprint already uses
(`DashboardEditor`, `DashboardHost`, host controls, `DataGateway`,
`ui_dashboard` manifest). The spec below makes each box concrete.

---

## 3. Kernel

### 3.1 `DataGateway` (already exists, keep shape)

- Sole HTTP/SSE edge: `getHealth`, `getMeta`, `listPlugins`,
  `getDashboardLayout`, `putDashboardLayout` (debounced writer around it),
  `resetDashboardLayout`, `list*`, `getPerfSummary`, `subscribeFabricEvents`.
- No component imports `fetch` or `EventSource` directly. No component parses
  JSON. The gateway returns typed values.
- Gateway must **Zod-parse** on every response before returning (today Zod is
  test-only).

### 3.2 `LayoutStore` (new, extracted from `App.svelte`)

A single store owns the current `DashboardLayoutV2` and mutation methods:

```ts
interface LayoutStore {
  readonly layout: Readable<DashboardLayoutV2>;
  readonly loadError: Readable<string | null>;
  readonly editorOpen: Readable<boolean>;

  beginEdit(): void;
  endEdit(): void;                          // commits innerWrap + flushes PUT

  addRootTile(pluginId: string): void;
  addGroup(): void;
  addTileToGroup(groupId: string, pluginId: string): void;
  deleteRootItem(id: string): void;
  deleteGroupChildTile(groupId: string, tileId: string): void;
  updateTile(id: string, patch: Partial<DashboardTile>): void;
  updateGroup(id: string, patch: Partial<DashboardGroup>): void;
  moveTile(id: string, to: ParentRef): void;
  applyStructure(next: DashboardLayout, opts?: ApplyOpts): void;
  resetToBaseline(): Promise<void>;

  /** Plugins post geometry hints; store decides if it acts on them. */
  hintGrid(tileId: string, hint: GridHint): void;
}
```

Implementation notes:

- Load priority: **server → validate (Zod) → normalize (`layoutWithGrid`) →
  commit to store → mirror to localStorage**. If server fails, hydrate from
  localStorage and mark the store as "detached" (show a badge in chrome).
- Save: **debounced PUT (400 ms, per blueprint)** with a `flush()` called on
  edit exit, route change, unload. PUT errors surface through `loadError` and
  a toast — not `.catch(() => {})`.
- `hintGrid` is a **generic** method: it takes `GridHint = { colSpan, rowSpan,
  policy?: "expand" | "set" }`. Per-plugin rules (like "RAM only grows")
  belong in the plugin's manifest (`grid_policy`), not in the store body.

### 3.3 `GeometryEngine` (`gridPlacement.ts`, keep, clean up)

Pure functions only. Input is data, output is data or CSS strings. Must not
import `api/types.ts` enums that are manifest concepts. After refactor:

- `tileColSpan` **removes the `pluginId` switch**; default column span comes
  from `PluginManifest.default_size_hint` (parsed once at registry load).
- `alignGaugeColumnCount` moves to a perf-internal helper or is reframed as
  `alignChildColumnCount(colSpan: number, hostContext: HostContext)` — the
  word "gauge" stops appearing in geometry.
- Strip-width helper (`stripPortWidth(el, G)`) becomes one exported function
  consumed by both read and edit views; no `ResizeObserver` duplication.

### 3.4 `ManifestRegistry` (new)

Two layers — the **data manifest** (from the API: `PluginEntry.ui_dashboard`)
and the **runtime registration** (code in the shell):

```ts
interface PluginRegistration {
  id: string;                        // "perf.cpu", "dhcp.pools", …
  tile: Component<DashboardTileProps>;         // Svelte component
  settings?: Component<PluginSettingsProps>;   // plugin-owned overlay section
  defaultOptions?: (manifest) => TileOptions;  // typed per-plugin
  optionsSchema?: ZodSchema<TileOptions>;      // Zod for options validation
  dataHook?: (gateway, tile, bus) => Readable<PluginData>;
  gridPolicy?: {                               // replaces onPerfTileGridHint
    onHint?: (current: GridPlacement, hint: GridHint) => GridPlacement;
    defaultSpan?: { col: number; row: number };
  };
}

interface ManifestRegistry {
  register(r: PluginRegistration): void;
  get(id: string): PluginRegistration | undefined;
  list(): PluginRegistration[];
  resolveManifest(id: string): UiDashboardManifest | null; // from API listPlugins
}
```

- The runtime registry is **populated in one file** at boot (e.g.
  `lib/plugins/registry.ts`) so the shell knows all built-in plugins without
  `if/else` elsewhere.
- Future external plugins (out of scope for v1) will plug in through the same
  API, either by lazy-importing bundles or via iframe embeds (`embed_path`)
  per blueprint.

### 3.5 Error boundary + fault isolation

Kernel wraps every mounted tile in a `TileErrorBoundary`:

- On thrown error during render: replace with a typed placeholder
  (`<TileFallback reason="error" pluginId=… details={err.message}/>`).
- On unknown `pluginId`: `<TileFallback reason="unknown"/>`.
- On `manifest.enabled === false`: `<TileFallback reason="disabled"
  recovery="Enable in Admin → Plugins"/>`.
- Remaining tiles continue to render (blueprint §"Fault isolation").

---

## 4. Plugin Host

### 4.1 `DashboardPage` (new, extracted from `App.svelte`)

Owns: edit mode, overlay state (`settingsTile`, `settingsGroup`), palette,
add/delete/move glue. Subscribes to `LayoutStore`. Mounts `DashboardHost`,
`TileSettingsOverlay`, `GroupSettingsOverlay`.

`App.svelte` after extract: global chrome (title, ThemeControls, mode
toolbar, admin link), hash routing, top-level error boundary, and a switch on
`route` that mounts `DashboardPage` or `AdminPage`. Target: < 120 lines.

### 4.2 `DashboardHost` (keep, split)

Responsibilities stay; plugin dispatch moves out:

- Palette markup.
- `svelte-dnd-action` root + per-group wiring.
- Grid CSS emission.
- **Delegates tile rendering** to `<PluginTileMount tile={…}/>`, which asks
  `ManifestRegistry.get(tile.pluginId)` for the component (no `if/else`).
- Delegates strip measurement to the single `stripPortWidth` helper.

Target: < 350 lines, no pluginId literals.

### 4.3 Host controls (blueprint §"Host controls")

Implement the four host controls as Svelte components inside the host layer:

- `SinglePanelHost` (today's implicit default).
- `TabControlHost` — multiple tiles, one visible, tab strip in chrome.
- `VerticalStackHost` — ordered stack with per-block row heights.
- `SplitGridHost` — 2×2 cell matrix with percentage splits.

`DashboardTile.hostControl` picks the wrapper; a tile is oblivious to which
wrapper it lives in — it just receives `PluginTileProps` (see §5.1). For
**v1 scope** we may ship only `single-panel` in code and keep the other three
as registered-but-throws (TileFallback with reason `"host-control-not-yet-implemented"`)
so the data contract stays truthful without shipping dead UI.

### 4.4 Settings overlays (keep, decompose)

`TileSettingsOverlay` becomes a shell with three slots:

1. **Placement form** — grid placement (col/row/colSpan/rowSpan), parent
   selector, clamp rules (delegated to `GeometryEngine`). Always shown.
2. **Generic tile fields** — display mode + host control from
   `manifest.allowed_host_controls`. Always shown when the plugin declares
   them.
3. **Plugin settings slot** — `registration.settings` component, mounted with
   a `bind:options`. Plugin owns its own Zod schema and its own form. Shell
   knows nothing about `perf_max_cols` or `cpu_total`.

`GroupSettingsOverlay` stays as-is (it's clean).

### 4.5 `EventBus` (new, tiny)

Wraps `DataGateway.subscribeFabricEvents`. Provides:

```ts
interface EventBus {
  subscribe<T>(topic: string, selector: (payload: unknown) => T | null,
               onValue: (v: T) => void): () => void;
}
```

One subscription to SSE at the kernel, one dispatcher. Plugins subscribe by
topic (`"fabric.perf.updated"`, `"discovery.scan.updated"`, …) in their
`dataHook`. No more `liveCpuPercent` prop drilled from `App.svelte` through
`DashboardHost`.

---

## 5. Plugins

### 5.1 Plugin shape

```ts
type DashboardTileProps = {
  tile: DashboardTile;           // id, grid, options, hostControl, displayMode
  manifest: UiDashboardManifest; // from API (supports_compact, allowed_host_controls, …)
  gateway: DataGateway;
  bus: EventBus;
  hostContext: {
    inGroup: boolean;
    containerColumns: number;    // 12 on root; G on inner grid
    editing: boolean;
    openSettings?: () => void;
  };
  /** Plugins ask the host for a grid hint; host decides what to do. */
  hint: (h: GridHint) => void;
};

type PluginSettingsProps = {
  tile: DashboardTile;
  bindOptions: Writable<TileOptions>;
};
```

Rules:

- Plugins never import `LayoutStore`, `DashboardHost`, or anything from
  `lib/dashboard/` except the `types` barrel and the public `hostContext`.
- Plugins read `tile.displayMode` and `tile.hostControl` themselves — no
  shell-side translation. If a plugin chooses to ignore these, its manifest
  should declare `supports_compact: false` or a single `allowed_host_controls`
  accordingly, so the overlay hides the toggle.
- Plugins publish a **pure** `dataHook` that returns a `Readable<PluginData>`.
  Whether the source is a REST poll, a cached value, or an SSE topic is an
  implementation detail. The tile component is a pure function of
  `PluginData + tile`.

### 5.2 Reuse layers: host chrome, atoms, and plugin families

Most dashboard plugins should **not** hand-roll layout from scratch. Reuse stacks
in three layers (outside-in):

#### Layer A — Host chrome (always)

The **`PluginTileSurface`** / error boundary described in §3.5 and mounted by
`PluginTileMount` (§4.2): theme-safe padding, loading/error framing, edit-mode
affordances delegated from the host, **no** domain content. Plugins never draw
their own dashboard drag handles or outer Card when the host already provides
chrome.

#### Layer B — Atoms (`lib/components/`)

Small, presentation-only building blocks with **no** data fetching:

- `<SemicircleGauge …/>` — arc + bands; header/label props are presentational.
- `<MetricList …/>` — dense key/value or percent lines for compact modes.
- Shared table cell formatters, badges, skeleton rows.

Atoms are imported by **families** and by bespoke plugins; they stay free of
`DataGateway`.

#### Layer C — Plugin families (composite behaviours)

Families bundle **look-and-feel and interaction patterns** that many plugins
share. They sit **between** Layer A and a thin plugin **adapter** that only
wires data and options.

**Gauge family** (performance-style and anything “metric + optional chart readout”):

- A **`GaugeTileLayout`** (name TBD) composes: optional title/subtitle row,
  actions slot, responsive **grid of gauges** or a single hero gauge, alignment
  with `hostContext.containerColumns` / `hint()` for grid span feedback, and
  switches between “full gauge grid” vs “percent-only / metric list” driven by
  `tile.displayMode` and/or plugin `options` (e.g. `display_style`).
- **Perf plugins today** become registrations that pass column counts, labels,
  and `dataHook` output into this layout; `SemicircleGauge` remains an atom
  inside the family.

**Table family** (DHCP lists, reservations/static leases, future inventory grids):

- A **`TablePluginShell`** (name TBD) composes: Flowbite-aligned **table chrome**
  (toolbar slot, optional caption, refresh), **column definitions** (id, header,
  accessor, sort key, `visibleInCompact?: boolean`), **pagination** (optional:
  client-side slice vs server-driven `page` / `page_size` / `total` props —
  leases and large datasets should prefer server paging when the API supports
  it), **empty / loading / error** rows, and optional **row actions** (view,
  edit, delete).
- **Editing** is optional and staged: read-only grid first; then **row-level
  edit** (modal or side panel) or **inline** cells behind a capability flag /
  manifest extension — the shell owns the UX pattern; the plugin supplies
  validators and `onSave` / `onDelete` callbacks. Static leases / reservations
  are the natural “heavy” consumers once write APIs exist.
- **DHCP pools / clients / reservations** become thin adapters: `fetchPage`,
  column map, compact column set — not three copies of Card+Table+onMount.

**Custom plugins** skip Layer C and compose only Layers A + B (or third-party
widgets inside Layer A), e.g. discovery toolbar, embed iframe, bespoke chart.

**Naming / placement:** keep families under `lib/components/dashboard-families/`
(or similar) so they are **product UI primitives**, not imports from
`lib/dashboard/` engine internals. Only `PluginTileProps` crosses into plugins.

### 5.3 Built-in plugins as registrations

Re-express today's tiles as **data + registration** rather than as a Svelte
file per id:

```ts
// lib/plugins/perf.ts
export const perfCpu: PluginRegistration = {
  id: "perf.cpu",
  tile: PerfMetricTile,
  settings: PerfOptionsForm,
  optionsSchema: PerfOptionsSchema,
  defaultOptions: () => ({ cpu_total: false, display_style: "gauge" }),
  gridPolicy: { onHint: perfExpandOnlyHint },
  dataHook: (g, tile, bus) => combinePollAndSse(
    () => g.getPerfSummary(),
    bus.subscribe("fabric.perf.updated", pickCpu, /* emits */),
  ),
};
```

The file count drops (no more one-line `CpuTile.svelte` / `RamTile.svelte` /
`NwTile.svelte` / `DiskTile.svelte`) and the behaviour becomes data.

---

## 6. Layout engine (data model + pipeline)

### 6.1 Types (keep)

`DashboardLayoutV1`, `DashboardLayoutV2`, `RootLayoutItem = DashboardGroup |
RootTileItem`, `DashboardTile`, `DashboardGroup`, `GridPlacement`,
`TileOptions`. Keep the JSON Schema at `specs/dashboard/layout.schema.json`
as the canonical contract. Runtime types mirror it exactly.

### 6.2 Validation (tighten)

- `layoutStorage.parseDashboardLayout` replaced by a **Zod schema** derived
  from / aligned with `specs/dashboard/layout.schema.json`. No more
  hand-rolled validators with plugin-specific option fields.
- `TileOptions` becomes a **discriminated-union-per-plugin**, sourced from
  each plugin's `optionsSchema` at registry load. `z.union(pluginSchemas)` is
  assembled once and reused by `LayoutStore` on save.
- `parseDashboardLayout` is **forgiving on unknown plugin ids** (treat as
  unknown, render fallback) but **strict on geometry**.
- Forward compat: if `version > 2`, try a named migration ladder; if none
  matches, surface a clear error and keep the local copy untouched.

### 6.3 Pipeline

`load`:

1. `gateway.getDashboardLayout("default")` → raw.
2. `Zod.parse(raw)`; on failure: report and fall back to localStorage.
3. `migrate(raw)` → V2.
4. `layoutWithGrid(V2)` normalizes geometry.
5. Commit to store; mirror to localStorage; mark source (`server` |
   `local-cache`).

`mutate`:

1. Caller invokes a `LayoutStore` method.
2. Store applies the pure mutation, runs `layoutWithGrid`, updates in-memory.
3. Mirrors to localStorage immediately (unlimited frequency; cheap).
4. Schedules a **debounced 400 ms** `gateway.putDashboardLayout`.
5. On edit exit, route change, unload: `flush()` waits for the pending PUT.

`reset`:

1. `gateway.resetDashboardLayout("default")` → raw.
2. Same validate + migrate + normalize as `load`.

### 6.4 Default layout + legacy migration

- `initialDashboardLayout()` stays as a factory, but the **legacy-strip logic
  for `perf.summary`** (today hard-coded in `layoutStorage.ts`) moves into a
  named migration step keyed by payload version, documented and tested once.
- v1 `rowPanel` grouping is implemented only in `migrateV1ToV2` (`layoutTree.ts`);
  obsolete read-path helpers were removed in Phase 8.

---

## 7. Data edge

### 7.1 Runtime Zod on the wire

- `DataGateway` runs Zod on every response before returning.
- Dev server mocks and Playwright fixtures go through the same Zod path so
  mock drift fails fast (extends the existing `openapiZod.test.ts` check into
  runtime).
- PUT bodies are Zod-parsed pre-write as well.

### 7.2 SSE fan-out

- One `EventSource` at boot, owned by the `EventBus`.
- `EventBus.subscribe(topic, selector, onValue)` is the only way tiles receive
  SSE data.
- Reconnect with exponential backoff on `onerror`; expose connection state on
  the bus for the shell status indicator.

### 7.3 Auth

- `authToken` remains a gateway concern.
- Embed tokens (`eab`) per blueprint §"Optional `embed_path`" remain
  gateway-scoped; iframe plugins are out of runtime scope for v1 but the
  contract must not regress.

---

## 8. Theme + chrome

Theme is already right-sized. The only change is that the **shell renders
`ThemeControls` always** and dashboard-only toggles (accent visibility) live
in `DashboardPage`, not in `App.svelte`.

---

## 9. Testing strategy

Per `docs/architecture/testing.md` (100% target, 99% floor), the unit
coverage story becomes:

| Layer | Tool | Coverage focus |
|---|---|---|
| GeometryEngine | Vitest | packing, reorder, strip/wrap invariants, `layoutWithGrid`. **No plugin ids.** |
| LayoutStore | Vitest | load precedence, debounce-on-save, flush-on-exit, hint policy, reset. |
| ManifestRegistry | Vitest | resolve/register, unknown plugin fallback. |
| Plugin settings schemas | Vitest | each plugin's Zod options schema accepts valid and rejects invalid. |
| TileErrorBoundary | Vitest + svelte-testing-library | error, unknown, disabled states. |
| `DashboardPage` DnD | Playwright | root + group DnD, cross-zone move, keyboard fallback. |
| Render parity | Playwright | read-view and edit-view pixel-stable for the same layout. |
| Zod drift | Vitest | one mock per GET fixture parses cleanly; one PUT round-trips. |

---

## 10. Acceptance (what done looks like)

Done for this spec means all of the below are true:

1. **No file outside `lib/plugins/`** contains a string literal `pluginId`
   compare. (CI guard: grep.)
2. `gridPlacement.ts` has zero imports from `api/types` enums and zero
   plugin-id literals.
3. `App.svelte` ≤ 120 lines; `DashboardHost.svelte` ≤ 350 lines;
   `TileSettingsOverlay.svelte` ≤ 250 lines (rest in plugin settings forms).
4. `LayoutStore.putDashboardLayout` is debounced 400 ms and flushes on
   `endEdit`, route change, and `beforeunload`; PUT errors surface as
   toasts/`loadError`.
5. `DataGateway` Zod-parses every response. `openapiZod.ts` is imported by
   runtime code, not only tests.
6. Unknown or disabled plugins render a typed `TileFallback` with a recovery
   action. An exception inside a tile never breaks the grid.
7. Adding a new built-in plugin requires only: one registration file under
   `lib/plugins/<plugin>/`, one optional settings fragment, one Zod options
   schema, one `dataHook`. Zero edits in `lib/dashboard/`.
8. Host controls that are not yet implemented (`tab-control`,
   `vertical-stack`, `split-grid`) render a typed placeholder instead of
   silently behaving like `single-panel`.

---

## 11. Non-goals for this spec

- External plugin loading (marketplace, iframe embeds beyond today's
  `embed_path`) — tracked in `docs/architecture/marketplace.md` and blueprint
  §"Optional `embed_path`".
- Multi-user conflict resolution beyond last-write-wins.
- Live collaborative editing.
- WYSIWYG theming / token editor.
- Chart library selection (settled by ADR-0047).

---

## 12. Mapping to existing accepted docs

| Accepted doc | Section of this spec |
|---|---|
| `docs/architecture/dashboard-plugin-blueprint.md` | §2 layers, §4 host, §4.3 host controls, §5 plugin shape. |
| `docs/architecture/ui.md` | §3.5 error boundary, §7 data edge, §4.4 settings. |
| `docs/architecture/plugins.md` | §3.4 registry, §5.1 plugin shape. |
| `docs/architecture/ui-design-system.md` | §5.2 shared primitives (promote gauge + table). |
| ADR-0046 (Flowbite Svelte v2) | §3.4 settings slot stays inside Flowbite modals. |
| ADR-0047 (charts + bespoke SVG) | §5.2 (`SemicircleGauge` is bespoke SVG). |
| `specs/dashboard/layout.schema.json` | §6.1 canonical type source. |
| `specs/contracts/ui_dashboard_plugin.py` | §3.4 — the Python stub is expanded to carry the fields this spec needs. |

When we execute the plan, parts of this spec will be promoted into the
Accepted blueprint via an ADR (or a set of ADRs). The rest stays as working
material.
