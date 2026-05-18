import { fireEvent } from "@testing-library/dom";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import PluginPalette from "./PluginPalette.svelte";
import {
  resetPaletteDisplaySettings,
  setPaletteDropShadow,
  setPaletteTransparency,
} from "./paletteDisplaySettings";

describe("PluginPalette", () => {
  beforeAll(() => {
    if (typeof PointerEvent === "undefined") {
      globalThis.PointerEvent = class extends MouseEvent {
        declare pointerId: number;
        declare pointerType: string;
        constructor(type: string, init?: PointerEventInit) {
          super(type, init);
          this.pointerId = init?.pointerId ?? 0;
          this.pointerType = init?.pointerType ?? "";
        }
      } as typeof PointerEvent;
    }
  });

  afterEach(() => {
    resetPaletteDisplaySettings();
    try {
      localStorage.removeItem("kea-fabric-palette-dock");
      localStorage.removeItem("kea-fabric-palette-float-pos");
      localStorage.removeItem("kea-fabric-palette-display");
    } catch {
      /* ignore */
    }
  });

  it("renders search and add container when onAddGroup provided", () => {
    const onAddGroup = vi.fn();
    render(PluginPalette, {
      props: {
        plugins: [{ id: "dhcp.pools", name: "Pools", enabled: true }],
        onAddGroup,
      },
    });
    expect(screen.getByTestId("layout-add-container")).toBeTruthy();
  });

  it("renders tab and stack container chips when handlers provided", () => {
    const onAddTabGroup = vi.fn();
    const onAddStackGroup = vi.fn();
    render(PluginPalette, {
      props: {
        plugins: [{ id: "dhcp.pools", name: "Pools", enabled: true }],
        onAddGroup: vi.fn(),
        onAddTabGroup,
        onAddStackGroup,
      },
    });
    fireEvent.click(screen.getByTestId("layout-add-tab-container"));
    fireEvent.click(screen.getByTestId("layout-add-stack-container"));
    expect(onAddTabGroup).toHaveBeenCalledTimes(1);
    expect(onAddStackGroup).toHaveBeenCalledTimes(1);
  });

  it("exposes dock mode controls (inline, sticky, float)", () => {
    const mem: Record<string, string> = {
      "kea-fabric-palette-dock": JSON.stringify("inline"),
    };
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (k: string) => (k in mem ? mem[k]! : null),
        setItem: (k: string, v: string) => {
          mem[k] = v;
        },
        removeItem: (k: string) => {
          delete mem[k];
        },
        clear: () => {
          for (const x of Object.keys(mem)) delete mem[x];
        },
        key: () => null,
        get length() {
          return Object.keys(mem).length;
        },
      } as Storage,
    );
    render(PluginPalette, {
      props: {
        plugins: [{ id: "dhcp.pools", name: "Pools", enabled: true }],
        onAddGroup: vi.fn(),
      },
    });
    expect(screen.getByTestId("palette-dock-inline")).toBeTruthy();
    expect(screen.getByTestId("palette-dock-sticky")).toBeTruthy();
    expect(screen.getByTestId("palette-dock-float")).toBeTruthy();
    expect(screen.queryByTestId("palette-float-drag-handle")).toBeNull();
  });

  it("dock mode toggles update positioning classes on the palette shell", () => {
    render(PluginPalette, {
      props: {
        plugins: [{ id: "dhcp.pools", name: "Pools", enabled: true }],
        onAddGroup: vi.fn(),
      },
    });
    const shell = screen.getByTestId("layout-edit-palette-v2");
    fireEvent.click(screen.getByTestId("palette-dock-float"));
    expect(shell.className).toMatch(/\bfixed\b/);
    expect(screen.getByTestId("palette-float-drag-handle")).toBeTruthy();
    fireEvent.click(screen.getByTestId("palette-dock-sticky"));
    expect(shell.className).toMatch(/\bsticky\b/);
    fireEvent.click(screen.getByTestId("palette-dock-inline"));
    expect(shell.className).not.toMatch(/\bfixed\b/);
    expect(shell.className).not.toMatch(/\bsticky\b/);
  });

  it("floating drag handle persists position after pointer drag", async () => {
    const mem: Record<string, string> = {};
    vi.stubGlobal(
      "localStorage",
      {
        getItem: (k: string) => (k in mem ? mem[k]! : null),
        setItem: (k: string, v: string) => {
          mem[k] = v;
        },
        removeItem: (k: string) => {
          delete mem[k];
        },
        clear: () => {
          for (const x of Object.keys(mem)) delete mem[x];
        },
        key: () => null,
        get length() {
          return Object.keys(mem).length;
        },
      } as Storage,
    );
    render(PluginPalette, {
      props: {
        plugins: [{ id: "dhcp.pools", name: "Pools", enabled: true }],
        onAddGroup: vi.fn(),
      },
    });
    fireEvent.click(screen.getByTestId("palette-dock-float"));
    await tick();
    const chrome = screen.getByTestId("layout-edit-palette-chrome");
    const handle = screen.getByTestId("palette-float-drag-handle");
    vi.spyOn(chrome, "getBoundingClientRect").mockReturnValue({
      width: 280,
      height: 200,
      top: 96,
      left: 400,
      bottom: 296,
      right: 680,
      x: 400,
      y: 96,
      toJSON: () => ({}),
    } as DOMRect);
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        button: 0,
        pointerType: "mouse",
      }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 140,
        clientY: 120,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: 140,
        clientY: 120,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    const stored = mem["kea-fabric-palette-float-pos"];
    expect(stored).toBeDefined();
    const pos = JSON.parse(stored!) as { left: number; top: number };
    expect(pos.left).toBeGreaterThan(8);
    expect(pos.top).toBeGreaterThan(8);
  });

  it("respects paletteDisplaySettings.dropShadow off on outer shell", async () => {
    setPaletteDropShadow(false);
    render(PluginPalette, {
      props: {
        plugins: [{ id: "dhcp.pools", name: "Pools", enabled: true }],
        onAddGroup: vi.fn(),
      },
    });
    await tick();
    const shell = screen.getByTestId("layout-edit-palette-v2");
    expect(shell.className).toMatch(/\bshadow-none\b/);
  });

  it("respects paletteDisplaySettings.transparency off on chrome", async () => {
    setPaletteTransparency(false);
    render(PluginPalette, {
      props: {
        plugins: [{ id: "dhcp.pools", name: "Pools", enabled: true }],
        onAddGroup: vi.fn(),
      },
    });
    await tick();
    const chrome = screen.getByTestId("layout-edit-palette-chrome");
    expect(chrome.className).toMatch(/\bbackdrop-blur-none\b/);
    expect(chrome.className).not.toMatch(/bg-gray-350\/70/);
  });
});
