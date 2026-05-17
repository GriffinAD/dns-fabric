import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataGateway } from "./dataGateway";
import { appendBootFailureUi, mountOperatorApp } from "./operatorBoot";
import { resolvePluginTileMount } from "./plugins/core/registry";

describe("appendBootFailureUi", () => {
  let target: HTMLDivElement;

  afterEach(() => {
    target?.remove();
  });

  it("renders message and stack for Error", () => {
    target = document.createElement("div");
    document.body.appendChild(target);
    const err = new Error("boom");
    err.stack = "Error: boom\n  at x.ts:1:1";
    appendBootFailureUi(target, err);
    expect(target.textContent).toContain("boom");
    expect(target.textContent).toContain("at x.ts");
    expect(target.querySelector("pre")?.textContent).toContain("Error: boom");
  });

  it("renders string rejection values", () => {
    target = document.createElement("div");
    document.body.appendChild(target);
    appendBootFailureUi(target, "plain");
    expect(target.textContent).toContain("plain");
  });
});

describe("mountOperatorApp", () => {
  afterEach(() => {
    delete (globalThis as { __KEA_FABRIC_E2E_THROWING?: boolean }).__KEA_FABRIC_E2E_THROWING;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    cleanup();
  });

  it("mounts App when gateway bootstrap succeeds", async () => {
    vi.spyOn(DataGateway.prototype, "listPlugins").mockResolvedValue({ items: [] });
    vi.spyOn(DataGateway.prototype, "getDashboardLayout").mockResolvedValue({ version: 2, items: [] });
    vi.spyOn(DataGateway.prototype, "subscribeFabricEvents").mockReturnValue(() => {});

    const target = document.createElement("div");
    document.body.appendChild(target);
    await mountOperatorApp(target);

    expect(screen.getByText("Kea Fabric")).toBeTruthy();
    target.remove();
  });

  it("registers e2e.throwing resolver when VITE_E2E_THROWING is set", async () => {
    vi.stubEnv("VITE_E2E_THROWING", "1");
    const registry = await import("./plugins/core/registry");
    const spy = vi.spyOn(registry, "registerDynamicPluginResolver");

    vi.spyOn(DataGateway.prototype, "listPlugins").mockResolvedValue({ items: [] });
    vi.spyOn(DataGateway.prototype, "getDashboardLayout").mockResolvedValue({ version: 2, items: [] });
    vi.spyOn(DataGateway.prototype, "subscribeFabricEvents").mockReturnValue(() => {});

    const target = document.createElement("div");
    document.body.appendChild(target);
    await mountOperatorApp(target);

    expect(spy).toHaveBeenCalledWith("e2e.throwing", expect.any(Function));
    expect((globalThis as { __KEA_FABRIC_E2E_THROWING?: boolean }).__KEA_FABRIC_E2E_THROWING).toBe(true);
    const mountRes = resolvePluginTileMount({
      gateway: new DataGateway(""),
      tile: {
        id: "e2e-t",
        pluginId: "e2e.throwing",
        hostControl: "single-panel",
        displayMode: "full",
      },
      editLayout: false,
    });
    expect(mountRes?.component).toBeTruthy();
    spy.mockRestore();
    target.remove();
  });

  it("renders boot failure UI when loadSvelteAndApp rejects", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    await mountOperatorApp(target, {
      loadSvelteAndApp: async () => {
        throw new Error("load failed");
      },
    });
    expect(target.textContent).toContain("load failed");
    target.remove();
  });
});
