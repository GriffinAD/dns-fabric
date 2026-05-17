/**
 * Zod validation for dashboard layout JSON (mirrors `specs/dashboard/layout.schema.json`).
 * Used by `layoutStorage.parseDashboardLayout` and `DataGateway` layout GET/reset.
 */
import { z } from "zod";

import { GRID_COLUMNS, isCompleteGridPlacement, isCompleteGroupChildGrid } from "../grid/gridPlacement";
import { layoutGraphHasDuplicateIds, layoutMaxNestedGroupDepth } from "../migration";
import { tileOptionsSchemaForPlugin } from "./tileOptionsZod";
import type {
  DashboardGroup,
  DashboardLayout,
  DashboardLayoutV1,
  DashboardLayoutV2,
  DashboardLayoutV3,
  DashboardTile,
  GridPlacement,
  GroupChild,
  RootLayoutItem,
  RootTileItem,
} from "../types";
import { MAX_DASHBOARD_GROUP_DEPTH, isDashboardGroupNode } from "../types";

const hostControlEnum = z.enum(["single-panel", "tab-control", "vertical-stack", "split-grid"]);

export const dashboardGridPlacementSchema = z
  .object({
    col: z.number().int().min(0).max(10000),
    row: z.number().int().min(0),
    colSpan: z.number().int().min(1).max(GRID_COLUMNS),
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

const groupJsonSchemaV3: z.ZodTypeAny = z.lazy(() =>
  z
    .object({
      kind: z.literal("group"),
      id: z.string().min(1),
      showBorder: z.boolean().optional(),
      innerWrap: z.boolean().optional(),
      grid: dashboardGridPlacementSchema.nullish(),
      children: z.array(z.union([dashboardTileJsonSchema, groupJsonSchemaV3])),
    })
    .strict()
    .superRefine((g, ctx) => {
      if (g.grid != null && !isCompleteGridPlacement(g.grid)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["grid"], message: "invalid group grid placement" });
      }
      const parentAutoWrap = g.innerWrap === true;
      if (parentAutoWrap) {
        for (let i = 0; i < g.children.length; i++) {
          const c = g.children[i];
          if (c && typeof c === "object" && "kind" in c && (c as { kind?: string }).kind === "group") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["children", i],
              message: "innerWrap group cannot contain nested groups",
            });
          }
        }
      }
      g.children.forEach((c, i) => {
        if (c && typeof c === "object" && "kind" in c && (c as { kind?: string }).kind === "group") {
          const cg = c as { grid?: unknown };
          if (cg.grid != null && !isCompleteGroupChildGrid(cg.grid as GridPlacement, parentAutoWrap)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["children", i, "grid"],
              message: "invalid nested group grid for parent innerWrap mode",
            });
          }
          return;
        }
        const t = c as { grid?: unknown };
        if (t.grid != null && !isCompleteGroupChildGrid(t.grid as GridPlacement, parentAutoWrap)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["children", i, "grid"],
            message: "invalid child grid for group innerWrap mode",
          });
        }
      });
    }),
);

const rootLayoutItemJsonSchemaV3 = z.union([groupJsonSchemaV3, rootTileJsonSchema]);

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

const layoutV3JsonSchema = z
  .object({
    version: z.literal(3),
    items: z.array(rootLayoutItemJsonSchemaV3),
  })
  .strict()
  .superRefine((L, ctx) => {
    const items = normalizeItemsFromParsedV3(L.items);
    if (layoutMaxNestedGroupDepth(items) > MAX_DASHBOARD_GROUP_DEPTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: `nested groups exceed max depth (${MAX_DASHBOARD_GROUP_DEPTH})`,
      });
    }
    if (layoutGraphHasDuplicateIds(items)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "duplicate id in layout graph",
      });
    }
  });

/** Raw layout JSON after Zod parse (before `normalizeLayoutFromJson`). */
export const dashboardLayoutJsonSchema = z.union([layoutV1JsonSchema, layoutV2JsonSchema, layoutV3JsonSchema]);

export type DashboardLayoutJson = z.infer<typeof dashboardLayoutJsonSchema>;

function normalizeTileJson(t: DashboardTile): RootTileItem {
  return { ...t, kind: "tile" } as RootTileItem;
}

function normalizeGroupFromParsedV3(g: {
  kind: "group";
  id: string;
  showBorder?: boolean;
  innerWrap?: boolean;
  grid?: unknown;
  children: unknown[];
}): DashboardGroup {
  return {
    kind: "group",
    id: g.id,
    showBorder: g.showBorder !== false,
    innerWrap: g.innerWrap,
    grid: g.grid as DashboardGroup["grid"],
    children: g.children.map((c) => {
      if (c && typeof c === "object" && "kind" in c && (c as { kind?: string }).kind === "group") {
        return normalizeGroupFromParsedV3(c as typeof g);
      }
      return c as DashboardTile;
    }) as GroupChild[],
  };
}

function normalizeItemsFromParsedV3(
  items: Array<z.infer<typeof rootTileJsonSchema> | z.infer<typeof groupJsonSchemaV3>>,
): RootLayoutItem[] {
  const out: RootLayoutItem[] = [];
  for (const item of items) {
    if ("kind" in item && item.kind === "group") {
      out.push(normalizeGroupFromParsedV3(item as Parameters<typeof normalizeGroupFromParsedV3>[0]));
    } else {
      out.push(normalizeTileJson(item as DashboardTile));
    }
  }
  return out;
}

export function normalizeLayoutFromJson(parsed: DashboardLayoutJson): DashboardLayout {
  if (parsed.version === 1) {
    return { version: 1, tiles: parsed.tiles as DashboardTile[] } satisfies DashboardLayoutV1;
  }
  if (parsed.version === 3) {
    const items = normalizeItemsFromParsedV3(parsed.items);
    return { version: 3, items } satisfies DashboardLayoutV3;
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
