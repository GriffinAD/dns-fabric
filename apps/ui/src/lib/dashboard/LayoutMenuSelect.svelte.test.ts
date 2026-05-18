import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import LayoutMenuSelect from "./LayoutMenuSelect.svelte";

describe("LayoutMenuSelect", () => {
  it("invokes export and import handlers then resets the select", () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    render(LayoutMenuSelect, { props: { onExport, onImport } });

    const select = screen.getByLabelText("Layout") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "export" } });
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "import" } });
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(select.value).toBe("");
  });
});
