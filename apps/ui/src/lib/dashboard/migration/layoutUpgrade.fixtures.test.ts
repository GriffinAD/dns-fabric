import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ensureLayoutV2 } from "./layoutUpgrade";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("migration golden fixtures", () => {
  it("upgrades v1 empty tiles fixture to v2", () => {
    const raw = readFileSync(join(__dirname, "__fixtures__", "layout-v1-empty-tiles.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const v2 = ensureLayoutV2(parsed as Parameters<typeof ensureLayoutV2>[0]);
    expect(v2.version).toBe(2);
    expect(v2.items).toEqual([]);
  });
});
