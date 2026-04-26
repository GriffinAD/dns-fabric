import { fireEvent } from "@testing-library/dom";
import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import PluginPalette from "./PluginPalette.svelte";

describe("PluginPalette", () => {
  afterEach(() => {
    try {
      localStorage.removeItem("kea-fabric-palette-dock");
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

  it("exposes dock mode controls (inline, sticky, float)", () => {
    render(PluginPalette, {
      props: {
        plugins: [{ id: "dhcp.pools", name: "Pools", enabled: true }],
        onAddGroup: vi.fn(),
      },
    });
    expect(screen.getByTestId("palette-dock-inline")).toBeTruthy();
    expect(screen.getByTestId("palette-dock-sticky")).toBeTruthy();
    expect(screen.getByTestId("palette-dock-float")).toBeTruthy();
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
    fireEvent.click(screen.getByTestId("palette-dock-sticky"));
    expect(shell.className).toMatch(/\bsticky\b/);
    fireEvent.click(screen.getByTestId("palette-dock-inline"));
    expect(shell.className).not.toMatch(/\bfixed\b/);
    expect(shell.className).not.toMatch(/\bsticky\b/);
  });
});
