import { fireEvent, waitFor } from "@testing-library/dom";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";

import { z } from "zod";

import BaseDataTableModal from "./BaseDataTableModal.svelte";
import BaseDataTableModalSaveAllHarness from "./BaseDataTableModalSaveAllHarness.svelte";
import type { BaseDataTableColumn } from "./baseDataTable";

const columns: BaseDataTableColumn[] = [
  {
    header: "Name",
    fieldKey: "name",
    accessor: (r) => (r as { name: string }).name,
    editable: true,
    editor: "text",
  },
];

describe("BaseDataTableModal", () => {
  it("renders read-only table when allowEdit is false", async () => {
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", name: "Ada" }],
        columns,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: false,
      },
    });
    await tick();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save row" })).toBeNull();
  });

  it("saves edited row via onCommit", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", name: "Ada" }],
        columns,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: true,
        onCommit,
      },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const input = screen.getByDisplayValue("Ada") as HTMLInputElement;
    input.value = "Bob";
    fireEvent.input(input);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await tick();
    expect(onCommit).toHaveBeenCalledWith({ rowId: "1", patch: { name: "Bob" } });
  });

  it("shows save error when onCommit rejects", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("save failed"));
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", name: "Ada" }],
        columns,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: true,
        onCommit,
      },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const input = screen.getByDisplayValue("Ada") as HTMLInputElement;
    input.value = "X";
    fireEvent.input(input);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await tick();
    await waitFor(() => {
      expect(screen.getByTestId("modal-save-error").textContent).toContain("save failed");
    });
  });

  it("blocks save when zod validation fails", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const cols: BaseDataTableColumn[] = [
      {
        header: "Age",
        fieldKey: "age",
        accessor: (r) => String((r as { age: number }).age),
        getEditValue: (r) => (r as { age: number }).age,
        editable: true,
        editor: "number",
        zodSchema: z.coerce.number().int().min(18),
      },
    ];
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", age: 20 }],
        columns: cols,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: true,
        onCommit,
      },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    input.value = "3";
    fireEvent.input(input);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await tick();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/Number must be greater than or equal to 18/i)).toBeTruthy();
    const spin = screen.getByRole("spinbutton") as HTMLInputElement;
    spin.value = "22";
    fireEvent.input(spin);
    await tick();
    expect(screen.queryByText(/Number must be greater than or equal to 18/i)).toBeNull();
  });

  it("select editor renders placeholder option", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const cols: BaseDataTableColumn[] = [
      {
        header: "Status",
        fieldKey: "status",
        accessor: (r) => (r as { status: string }).status,
        editable: true,
        editor: "select",
        placeholder: "Pick…",
        options: [{ value: "a", label: "Alpha" }],
      },
    ];
    const { container } = render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", status: "a" }],
        columns: cols,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: true,
        onCommit,
      },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    expect(container.querySelector("option[value='']")?.textContent).toContain("Pick");
  });

  it("select editor commits string value", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const cols: BaseDataTableColumn[] = [
      {
        header: "Status",
        fieldKey: "status",
        accessor: (r) => (r as { status: string }).status,
        editable: true,
        editor: "select",
        options: [
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ],
      },
    ];
    const { container } = render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", status: "a" }],
        columns: cols,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: true,
        onCommit,
      },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const sel = container.querySelector("select");
    expect(sel).toBeTruthy();
    fireEvent.change(sel!, { target: { value: "b" } });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await tick();
    expect(onCommit).toHaveBeenCalledWith({ rowId: "1", patch: { status: "b" } });
  });

  it("number editor commits numeric value", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const cols: BaseDataTableColumn[] = [
      {
        header: "N",
        fieldKey: "n",
        accessor: (r) => String((r as { n: number }).n),
        getEditValue: (r) => (r as { n: number }).n,
        editable: true,
        editor: "number",
      },
    ];
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", n: 1 }],
        columns: cols,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: true,
        onCommit,
      },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const input = screen.getByRole("spinbutton");
    fireEvent.input(input, { target: { value: "7" } });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await tick();
    expect(onCommit).toHaveBeenCalledWith({ rowId: "1", patch: { n: 7 } });
  });

  it("save all runs multiple dirty rows", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [
          { id: "1", name: "a" },
          { id: "2", name: "b" },
        ],
        columns,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: true,
        onCommit,
      },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    inputs[0]!.value = "a2";
    fireEvent.input(inputs[0]!);
    inputs[1]!.value = "b2";
    fireEvent.input(inputs[1]!);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await tick();
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2));
  });

  it("save all persists all dirty rows when parent updates items", async () => {
    render(BaseDataTableModalSaveAllHarness);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    inputs[0]!.value = "a2";
    fireEvent.input(inputs[0]!);
    inputs[1]!.value = "b2";
    fireEvent.input(inputs[1]!);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await tick();
    await waitFor(() => {
      expect(screen.getByTestId("commit-count").textContent).toBe("2");
    });
  });

  it("uses setPatchValue when provided", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const cols: BaseDataTableColumn[] = [
      {
        header: "Name",
        fieldKey: "name",
        accessor: (r) => (r as { name: string }).name,
        editable: true,
        editor: "text",
        setPatchValue: (patch, value) => {
          patch.custom = value;
        },
      },
    ];
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", name: "Ada" }],
        columns: cols,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: true,
        onCommit,
      },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const inp = screen.getByDisplayValue("Ada") as HTMLInputElement;
    inp.value = "Z";
    fireEvent.input(inp);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await tick();
    expect(onCommit).toHaveBeenCalledWith({ rowId: "1", patch: { custom: "Z" } });
  });

  it("filters rows in modal toolbar", async () => {
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [
          { id: "1", name: "Ada" },
          { id: "2", name: "Bob" },
        ],
        columns,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: false,
      },
    });
    await tick();
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.input(input, { target: { value: "bob" } });
    await tick();
    expect(screen.queryByText("Ada")).toBeNull();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("shows sort indicator only after clicking sortable header", async () => {
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [
          { id: "1", name: "Ada" },
          { id: "2", name: "Bob" },
        ],
        columns,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: false,
      },
    });
    await tick();
    expect(screen.queryByTestId("modal-sort-indicator-Name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    await tick();
    expect(screen.getByTestId("modal-sort-indicator-Name").textContent).toBe("▲");
  });

  it("supports modal default sort settings", async () => {
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [
          { id: "1", name: "Ada" },
          { id: "2", name: "Bob" },
        ],
        columns,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: false,
        defaultSortColumnId: "Name",
        defaultSortDirection: "desc",
      },
    });
    await tick();
    expect(screen.getByTestId("modal-sort-indicator-Name").textContent).toBe("▼");
  });

  it("exports from dropdown with JSON as default label", async () => {
    const te = await import("./tableExport");
    const spy = vi.spyOn(te, "triggerDownload").mockImplementation(() => {});
    render(BaseDataTableModal, {
      props: {
        open: true,
        title: "Modal",
        items: [{ id: "1", name: "Ada" }],
        columns,
        rowKey: (r) => (r as { id: string }).id,
        allowEdit: false,
      },
    });
    await tick();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open export options" }));
    await tick();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export CSV" }));
    await tick();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await tick();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
