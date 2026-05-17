import { describe, expect, it } from "vitest";

import { buildPaletteDragImageTile, PALETTE_DRAG_IMAGE_ID } from "./paletteDragGhost";

describe("paletteDragGhost", () => {
  it("buildPaletteDragImageTile uses stable ghost id", () => {
    const t = buildPaletteDragImageTile("dhcp.pools");
    expect(t.id).toBe(PALETTE_DRAG_IMAGE_ID);
    expect(t.id).toBe("__palette-drag-image__");
    expect(t.pluginId).toBe("dhcp.pools");
  });
});
