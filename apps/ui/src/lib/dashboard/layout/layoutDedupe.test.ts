import { describe, expect, it } from "vitest";

import { dedupeById } from "./layoutDedupe";

describe("dedupeById", () => {
  it("keeps first occurrence", () => {
    expect(dedupeById([{ id: "a" }, { id: "b" }, { id: "a" }])).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
