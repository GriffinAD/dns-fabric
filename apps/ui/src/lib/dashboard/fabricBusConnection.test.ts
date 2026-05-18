import { describe, expect, it } from "vitest";

import { fabricConnectionDotClass, fabricConnectionLabel } from "./fabricBusConnection";

describe("fabricBusConnection", () => {
  it("maps connection states to labels", () => {
    expect(fabricConnectionLabel("open")).toBe("Live");
    expect(fabricConnectionLabel("connecting")).toBe("Connecting…");
    expect(fabricConnectionLabel("error")).toBe("Stream error");
    expect(fabricConnectionLabel("idle")).toBe("Data idle");
  });

  it("maps connection states to dot classes", () => {
    expect(fabricConnectionDotClass("open")).toContain("emerald");
    expect(fabricConnectionDotClass("connecting")).toContain("amber");
    expect(fabricConnectionDotClass("error")).toContain("red");
    expect(fabricConnectionDotClass("idle")).toContain("slate");
  });
});
