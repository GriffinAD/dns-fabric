import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import TablePluginShell from "./TablePluginShell.svelte";

describe("TablePluginShell", () => {
  it("renders table rows via BaseDataTable", () => {
    render(TablePluginShell, {
      props: {
        title: "T",
        items: [{ id: "1", name: "Ada" }],
        err: null,
        emptyText: "none",
        compact: false,
        columns: [{ header: "Name", accessor: (r) => (r as { name: string }).name }],
        rowKey: (r) => (r as { id: string }).id,
      },
    });
    expect(screen.getByText("T")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
  });
});
