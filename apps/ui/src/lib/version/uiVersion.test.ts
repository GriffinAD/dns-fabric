import { describe, expect, it } from "vitest";
import { UI_VERSION } from "./uiVersion";

describe("uiVersion", () => {
  it("exports semver bootstrap", () => {
    expect(UI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
