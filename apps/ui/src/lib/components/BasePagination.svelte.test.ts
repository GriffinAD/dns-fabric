import { fireEvent } from "@testing-library/dom";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import BasePagination from "./BasePagination.svelte";

describe("BasePagination", () => {
  it("does not render for zero/one page", () => {
    const { container, unmount } = render(BasePagination, {
      props: { page: 1, totalPages: 1, onChange: vi.fn() },
    });
    expect(container.textContent?.trim()).toBe("");
    unmount();
    const { container: c2 } = render(BasePagination, {
      props: { page: 1, totalPages: 0, onChange: vi.fn() },
    });
    expect(c2.textContent?.trim()).toBe("");
  });

  it("renders first/last with ellipsis and current page", () => {
    render(BasePagination, {
      props: { page: 8, totalPages: 42, onChange: vi.fn() },
    });
    expect(screen.getByRole("button", { name: "Go to page 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to page 42" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to page 8" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByText("…").length).toBe(2);
  });

  it("disables arrow buttons at bounds", () => {
    const { rerender } = render(BasePagination, {
      props: { page: 1, totalPages: 3, onChange: vi.fn() },
    });
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(false);
    rerender({ page: 3, totalPages: 3, onChange: vi.fn() });
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("fires onChange via page click and arrow click", async () => {
    const onChange = vi.fn();
    render(BasePagination, {
      props: { page: 2, totalPages: 5, onChange },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Go to page 4" }));
    await fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onChange).toHaveBeenNthCalledWith(1, 4);
    expect(onChange).toHaveBeenNthCalledWith(2, 3);
  });

  it("supports keyboard navigation shortcuts", async () => {
    const onChange = vi.fn();
    render(BasePagination, {
      props: { page: 5, totalPages: 9, onChange },
    });
    const previous = screen.getByRole("button", { name: "Previous page" });
    await fireEvent.keyDown(previous, { key: "ArrowLeft" });
    await fireEvent.keyDown(previous, { key: "ArrowRight" });
    await fireEvent.keyDown(previous, { key: "Home" });
    await fireEvent.keyDown(previous, { key: "End" });
    expect(onChange).toHaveBeenNthCalledWith(1, 4);
    expect(onChange).toHaveBeenNthCalledWith(2, 6);
    expect(onChange).toHaveBeenNthCalledWith(3, 1);
    expect(onChange).toHaveBeenNthCalledWith(4, 9);
  });

  it("does not render jump input (owned by table footer)", () => {
    render(BasePagination, {
      props: { page: 2, totalPages: 42, onChange: vi.fn() },
    });
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
