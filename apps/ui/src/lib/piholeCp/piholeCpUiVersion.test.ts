import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatPiholeCpUiDisplayVersion,
  piholeCpApiMinorLine,
  readPiholeCpUiBuildFromEnv,
} from "./piholeCpUiVersion";

describe("piholeCpUiVersion", () => {
  it("derives minor line from API version", () => {
    expect(piholeCpApiMinorLine("0.4.0")).toBe("0.4");
    expect(piholeCpApiMinorLine("1.2.3")).toBe("1.2");
    expect(piholeCpApiMinorLine("bad")).toBe("bad");
    expect(piholeCpApiMinorLine("")).toBe("0.4");
  });

  it("formats display version with build stamp", () => {
    expect(formatPiholeCpUiDisplayVersion("0.4.0", "202505151430")).toBe("0.4.202505151430");
    expect(formatPiholeCpUiDisplayVersion("0.4.0", "v99")).toBe("0.4.99");
    expect(formatPiholeCpUiDisplayVersion("0.4.0", undefined)).toBe("0.4.dev");
    expect(formatPiholeCpUiDisplayVersion("0.4.0", "  ")).toBe("0.4.dev");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads embed build from import.meta.env when set", () => {
    vi.stubEnv("VITE_PIHOLE_CP_UI_BUILD", "202505151430");
    expect(readPiholeCpUiBuildFromEnv()).toBe("202505151430");
    vi.stubEnv("VITE_PIHOLE_CP_UI_BUILD", "  ");
    expect(readPiholeCpUiBuildFromEnv()).toBeUndefined();
  });
});
