/**
 * Zod validation for dashboard layout JSON (mirrors `specs/dashboard/layout.schema.json`).
 * Used by `layoutStorage.parseDashboardLayout` and `DataGateway` layout GET/reset.
 */
import { z } from "zod";

import { isCompleteGridPlacement, isCompleteGroupChildGrid } from "./gridPlacement";
import { tileOptionsSchemaForPlugin } from "./tileOptionsZod";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV1,
  DashboardLayoutV2,
  DashboardTile,
  RootLayoutItem,
  RootTileItem,
} from "./types";

const hostControlEnum = z.enum(["single-panel", "tab-control", "vertical-stack", "split-grid"]);

export const dashboardGridPlacementSchema = z
  .object({
    col: z.number().int().min(0).max(10000),
    row: z.number().int().min(0),
    colSpan: z.number().int().min(1).max(12),
    rowSpan: z.number().int().min(1).max(12),
  })
  .strict();

function refineTileOptions(val: { pluginId: string; options?: unknown }, ctx: z.RefinementCtx) {
  if (val.options === undefined) return;
  const schema = tileOptionsSchemaForPlugin(val.pluginId);
  const r = schema.safeParse(val.options);
  if (r.success) return;
  for (const issue of r.error.issues) {
    ctx.addIssue({
      ...issue,
      path: ["options", ...issue.path],
    });
  }
}

const dashboardTileJsonSchema = z
  .object({
    id: z.string().min(1),
    pluginId: z.string().min(1),
    hostControl: hostControlEnum,
    displayMode: z.enum(["compact", "full"]),
    region: z.string().optional(),
    rowPanel: z.string().min(1).max(64).optional(),
    kind: z.literal("tile").optional(),
    grid: dashboardGridPlacementSchema.nullish(),
    options: z.unknown().optional(),
  })
  .strict()
  .superRefine(refineTileOptions);

const rootTileJsonSchema = dashboardTileJsonSchema.superRefine((t, ctx) => {
  if (t.grid != null && !isCompleteGridPlacement(t.grid)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["grid"], message: "invalid root grid placement" });
  }
});

const groupJsonSchema = z
  .object({
    kind: z.literal("group"),
    id: z.string().min(1),
    showBorder: z.boolean().optional(),
    innerWrap: z.boolean().optional(),
    grid: dashboardGridPlacementSchema.nullish(),
    children: z.array(dashboardTileJsonSchema),
  })
  .strict()
  .superRefine((g, ctx) => {
    if (g.grid != null && !isCompleteGridPlacement(g.grid)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["grid"], message: "invalid group grid placement" });
    }
    const parentAutoWrap = g.innerWrap === true;
    g.children.forEach((c, i) => {
      if (c.grid != null && !isCompleteGroupChildGrid(c.grid, parentAutoWrap)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["children", i, "grid"],
          message: "invalid child grid for group innerWrap mode",
        });
      }
    });
  });

const rootLayoutItemJsonSchema = z.union([groupJsonSchema, rootTileJsonSchema]);

const layoutV1JsonSchema = z
  .object({
    version: z.literal(1),
    tiles: z.array(rootTileJsonSchema),
  })
  .strict();

const layoutV2JsonSchema = z
  .object({
    version: z.literal(2),
    items: z.array(rootLayoutItemJsonSchema),
  })
  .strict();

/** Raw layout JSON after Zod parse (before `normalizeLayoutFromJson`). */
export const dashboardLayoutJsonSchema = z.union([layoutV1JsonSchema, layoutV2JsonSchema]);

export type DashboardLayoutJson = z.infer<typeof dashboardLayoutJsonSchema>;

export function normalizeLayoutFromJson(parsed: DashboardLayoutJson): DashboardLayout {
  if (parsed.version === 1) {
    return { version: 1, tiles: parsed.tiles as DashboardTile[] } satisfies DashboardLayoutV1;
  }
  const items: RootLayoutItem[] = [];
  for (const item of parsed.items) {
    if ("kind" in item && item.kind === "group") {
      const g = item;
      items.push({
        ...g,
        showBorder: g.showBorder !== false,
      } as DashboardGroup);
    } else {
      const t = item;
      items.push({ ...t, kind: "tile" } as RootTileItem);
    }
  }
  return { version: 2, items } satisfies DashboardLayoutV2;
}

/** Validate layout JSON; returns `null` if shape or placement rules fail. */
export function parseDashboardLayoutZod(value: unknown): DashboardLayout | null {
  const r = dashboardLayoutJsonSchema.safeParse(value);
  if (!r.success) return null;
  return normalizeLayoutFromJson(r.data);
}
