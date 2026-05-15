import { afterEach, describe, expect, it, vi } from "vitest";

import { readPiholeCpApiToken, writePiholeCpApiToken } from "./piholeCpApiToken";

describe("piholeCpApiToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  it("readPiholeCpApiToken prefers VITE_PIHOLE_CP_API_TOKEN", () => {
    vi.stubEnv("VITE_PIHOLE_CP_API_TOKEN", "from-env");
    sessionStorage.setItem("pihole-cp-api-token", "from-session");
    expect(readPiholeCpApiToken()).toBe("from-env");
  });

  it("readPiholeCpApiToken falls back to sessionStorage", () => {
    sessionStorage.setItem("pihole-cp-api-token", "from-session");
    expect(readPiholeCpApiToken()).toBe("from-session");
  });

  it("writePiholeCpApiToken stores and clears", () => {
    writePiholeCpApiToken("abc");
    expect(sessionStorage.getItem("pihole-cp-api-token")).toBe("abc");
    writePiholeCpApiToken("");
    expect(sessionStorage.getItem("pihole-cp-api-token")).toBeNull();
  });

  it("readPiholeCpApiToken returns empty when sessionStorage throws", () => {
    vi.stubEnv("VITE_PIHOLE_CP_API_TOKEN", "");
    vi.stubGlobal(
      "sessionStorage",
      {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        get length() {
          return 0;
        },
      } as Storage,
    );
    expect(readPiholeCpApiToken()).toBe("");
  });

  it("writePiholeCpApiToken ignores sessionStorage errors", () => {
    vi.stubGlobal(
      "sessionStorage",
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        get length() {
          return 0;
        },
      } as Storage,
    );
    expect(() => writePiholeCpApiToken("x")).not.toThrow();
  });
});
