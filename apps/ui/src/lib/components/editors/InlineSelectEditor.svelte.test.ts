import { fireEvent } from "@testing-library/dom";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import InlineSelectEditor from "./InlineSelectEditor.svelte";

describe("InlineSelectEditor", () => {
  it("renders options and forwards value changes", async () => {
    const onValueChange = vi.fn();
    render(InlineSelectEditor, {
      props: {
        value: "up",
        onValueChange,
        options: [
          { value: "up", label: "Up" },
          { value: "down", label: "Down", disabled: true },
        ],
        invalid: true,
        describedBy: "err-id",
      },
    });
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("up");
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(select.getAttribute("aria-describedby")).toBe("err-id");
    const down = screen.getByRole("option", { name: "Down" }) as HTMLOptionElement;
    expect(down.disabled).toBe(true);
    select.value = "down";
    await fireEvent.change(select);
    expect(onValueChange).toHaveBeenCalledWith("down");
  });

  it("supports empty placeholder and missing options", () => {
    render(InlineSelectEditor, {
      props: {
        value: "",
        onValueChange: () => {},
        placeholder: "Choose one",
      },
    });
    expect(screen.getByRole("option", { name: "Choose one" })).toBeTruthy();
  });
});
