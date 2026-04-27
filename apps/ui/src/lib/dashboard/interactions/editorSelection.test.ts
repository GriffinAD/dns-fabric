import { describe, expect, it } from "vitest";

import { editorGroupInPlay, editorTileInPlay } from "./editorSelection";

describe("editorSelection", () => {
  it("matches tile selection only in edit mode", () => {
    expect(editorTileInPlay(true, "tile", "t1", "t1")).toBe(true);
    expect(editorTileInPlay(false, "tile", "t1", "t1")).toBe(false);
    expect(editorTileInPlay(true, "group", "t1", "t1")).toBe(false);
  });

  it("matches group selection only in edit mode", () => {
    expect(editorGroupInPlay(true, "group", "g1", "g1")).toBe(true);
    expect(editorGroupInPlay(false, "group", "g1", "g1")).toBe(false);
    expect(editorGroupInPlay(true, "tile", "g1", "g1")).toBe(false);
  });
});
