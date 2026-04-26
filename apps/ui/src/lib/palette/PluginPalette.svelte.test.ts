import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import PluginPalette from "./PluginPalette.svelte";

describe("PluginPalette", () => {
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
});
