# Gauge primitive (operator UI)

The **`SemicircleGauge`** Svelte component (`apps/ui/src/lib/components/SemicircleGauge.svelte`)
renders a semicircle arc with optional threshold coloring. It is paired with
**`gaugeMath.ts`** (arc path, label placement) and **`gaugeThresholds.ts`**
(bucket → stroke class).

## When to use

- Perf and other “single primary metric” tiles that need a compact arc readout.
- Demos or admin previews that exercise the same primitive as production tiles.

Prefer **`GaugeTileLayout`** (`apps/ui/src/lib/components/GaugeTileLayout.svelte`)
for Card chrome, title, and loading/error slots so gauge tiles stay consistent.

## Props (summary)

| Prop | Role |
| --- | --- |
| `value` | 0–100 numeric percent (or clamped by caller). |
| `label` | Center text (e.g. resource name). |
| `bucket` | Threshold bucket from `gaugeThresholds` (`ok` / `warn` / `crit`). |
| `size` | Optional diameter in px (`gaugeMath` presets). |

See the component source for the full prop list and ARIA attributes.

## Related

- [Dashboard plugin blueprint](../architecture/dashboard-plugin-blueprint.md) §Plugin primitives (operator UI).
- Admin page includes a non-perf demo block (`data-testid="admin-gauge-primitive-demo"`).
