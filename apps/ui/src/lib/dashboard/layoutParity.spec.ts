import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { dashboardLayoutJsonSchema } from "./layoutZod";

const parityDir = resolve(__dirname, "../../../../../specs/dashboard/parity");

describe("layout parity fixtures (UI Zod)", () => {
  const fixtures = readdirSync(parityDir).filter((name) => name.startsWith("layout.") && name.endsWith(".json"));

  for (const name of fixtures) {
    it(name, () => {
      const raw = JSON.parse(readFileSync(join(parityDir, name), "utf-8")) as unknown;
      const parsed = dashboardLayoutJsonSchema.safeParse(raw);
      const expectedValid = name.includes(".valid.");
      expect(parsed.success).toBe(expectedValid);
    });
  }
});
