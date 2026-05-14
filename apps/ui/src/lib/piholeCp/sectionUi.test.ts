import { describe, expect, it } from "vitest";

import { asRecord, boolish, str } from "./sectionUi";

describe("sectionUi", () => {
  it("asRecord accepts plain objects", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord(null)).toBeNull();
    expect(asRecord([])).toBeNull();
    expect(asRecord("x")).toBeNull();
  });

  it("boolish", () => {
    expect(boolish(true)).toBe(true);
    expect(boolish(false)).toBe(false);
  });

  it("str", () => {
    expect(str("a")).toBe("a");
    expect(str("")).toBeNull();
    expect(str(3)).toBe("3");
  });
});
