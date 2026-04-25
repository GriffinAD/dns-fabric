import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import GaugeTileLayoutHarness from "./GaugeTileLayoutHarness.svelte";

describe("GaugeTileLayout", () => {
  it("renders title and body when idle", () => {
    render(GaugeTileLayoutHarness, {
      props: { title: "CPU", err: null, loading: false },
    });
    expect(screen.getByRole("heading", { name: "CPU" })).toBeTruthy();
    expect(screen.getByTestId("gauge-tile-body")).toBeTruthy();
  });

  it("shows error text when err is set", () => {
    render(GaugeTileLayoutHarness, {
      props: { title: "CPU", err: "boom", loading: false },
    });
    expect(screen.getByRole("alert").textContent?.trim()).toBe("boom");
    expect(screen.queryByTestId("gauge-tile-body")).toBeNull();
  });

  it("shows loading when loading is true", () => {
    render(GaugeTileLayoutHarness, {
      props: { title: "CPU", err: null, loading: true },
    });
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.queryByTestId("gauge-tile-body")).toBeNull();
  });

  it("applies custom bodyClass when idle", () => {
    const { container } = render(GaugeTileLayoutHarness, {
      props: {
        title: "CPU",
        err: null,
        loading: false,
        bodyClass: "custom-body-class",
      },
    });
    expect(container.querySelector(".custom-body-class")).toBeTruthy();
  });
});
