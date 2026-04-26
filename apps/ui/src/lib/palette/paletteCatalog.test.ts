import { describe, expect, it } from "vitest";

import { buildPaletteCatalog } from "./paletteCatalog";

describe("buildPaletteCatalog", () => {
  it("uses Plugins category when plugin id has no dot", () => {
    const items = buildPaletteCatalog([{ id: "single", name: "One", enabled: true }]);
    const plug = items.find((i) => i.kind === "plugin");
    expect(plug && plug.kind === "plugin" ? plug.category : "").toBe("Plugins");
  });

  it("uses Plugins category when dot is at position zero", () => {
    const items = buildPaletteCatalog([{ id: ".hidden", name: "H", enabled: true }]);
    const plug = items.find((i) => i.kind === "plugin");
    expect(plug && plug.kind === "plugin" ? plug.category : "").toBe("Plugins");
  });

  it("derives category from plugin id prefix", () => {
    const items = buildPaletteCatalog([{ id: "dhcp.leases", name: "Leases", enabled: true }]);
    const plug = items.find((i) => i.kind === "plugin");
    expect(plug && plug.kind === "plugin" ? plug.category : "").toBe("DHCP");
  });

  it("sorts by label within the same derived category", () => {
    const items = buildPaletteCatalog([
      { id: "dhcp.z", name: "Zebra", enabled: true },
      { id: "dhcp.a", name: "Alpha", enabled: true },
    ]);
    expect(items[1]?.kind === "plugin" && items[1].id).toBe("dhcp.a");
    expect(items[2]?.kind === "plugin" && items[2].id).toBe("dhcp.z");
  });

  it("places core add-group first and sorts plugins", () => {
    const items = buildPaletteCatalog([
      { id: "z.last", name: "Z", enabled: true },
      { id: "a.first", name: "A", enabled: true },
      { id: "off", name: "Off", enabled: false },
    ]);
    expect(items[0]?.kind).toBe("core");
    expect(items.map((i) => (i.kind === "plugin" ? i.id : null)).filter(Boolean)).toEqual([
      "a.first",
      "z.last",
    ]);
  });
});
