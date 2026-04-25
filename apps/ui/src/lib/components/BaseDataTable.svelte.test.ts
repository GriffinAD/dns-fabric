import { fireEvent, waitFor } from "@testing-library/dom";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import BaseDataTable from "./BaseDataTable.svelte";
import BaseDataTableHarness from "./BaseDataTableCoverageHarness.svelte";
import BaseDataTablePageClampHarness from "./BaseDataTablePageClampHarness.svelte";
import type { BaseDataTableColumn } from "./baseDataTable";
import { defaultBaseDataTableSettings, mergeBaseDataTableSettings } from "./baseDataTable";

function cols(): BaseDataTableColumn[] {
  return [
    { id: "name", header: "Name", accessor: (r) => (r as { name: string }).name },
    { id: "role", header: "Role", accessor: (r) => (r as { role: string }).role },
  ];
}

function manyItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: String(i), name: `u${i}`, role: "r" }));
}

describe("BaseDataTable", () => {
  it("renders toolbar, filter, and rows", () => {
    render(BaseDataTable, {
      props: {
        title: "Users",
        items: [
          { id: "1", name: "Ada", role: "dev" },
          { id: "2", name: "Bob", role: "ops" },
        ],
        err: null,
        emptyText: "empty",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
      },
    });
    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search…")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeTruthy();
    expect(screen.getByText("View all")).toBeTruthy();
  });

  it("shows skeleton when loading with no items", () => {
    render(BaseDataTable, {
      props: {
        title: "L",
        items: [],
        err: null,
        loading: true,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
      },
    });
    expect(document.querySelector('[data-testid="table-loading"]')).toBeTruthy();
  });

  it("shows error and invokes onRetry", async () => {
    const onRetry = vi.fn();
    render(BaseDataTable, {
      props: {
        title: "E",
        items: [],
        err: "boom",
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        onRetry,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await tick();
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows empty text when no rows", () => {
    render(BaseDataTable, {
      props: {
        title: "E",
        items: [],
        err: null,
        emptyText: "nothing here",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
      },
    });
    expect(screen.getByText("nothing here")).toBeTruthy();
  });

  it("shows no-matches when filter excludes all", async () => {
    render(BaseDataTable, {
      props: {
        title: "F",
        items: [{ id: "1", name: "Ada", role: "x" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        noMatchesText: "no hits",
      },
    });
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.input(input, { target: { value: "zzz" } });
    await tick();
    expect(screen.getByText("no hits")).toBeTruthy();
  });

  it("cycles sort when clicking the same header", async () => {
    render(BaseDataTable, {
      props: {
        title: "S",
        items: [
          { id: "1", name: "b", role: "a" },
          { id: "2", name: "a", role: "b" },
        ],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowExportCsv: false,
          allowExportJson: false,
          allowFilter: false,
        }),
      },
    });
    const nameBtn = screen.getByRole("button", { name: "Name" });
    fireEvent.click(nameBtn);
    await tick();
    expect(screen.getByTestId("sort-indicator-name").textContent).toBe("▲");
    fireEvent.click(nameBtn);
    await tick();
    expect(screen.getByTestId("sort-indicator-name").textContent).toBe("▼");
    fireEvent.click(nameBtn);
    await tick();
    expect(screen.queryByTestId("sort-indicator-name")).toBeNull();
    expect(nameBtn.closest("th")?.getAttribute("aria-sort")).toBe("none");
  });

  it("shows no sort indicator until a header is clicked", async () => {
    render(BaseDataTable, {
      props: {
        title: "SI",
        items: [
          { id: "1", name: "b", role: "a" },
          { id: "2", name: "a", role: "b" },
        ],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(screen.queryByTestId("sort-indicator-name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    await tick();
    expect(screen.getByTestId("sort-indicator-name").textContent).toBe("▲");
  });

  it("supports default sort column and direction from settings", () => {
    render(BaseDataTable, {
      props: {
        title: "DS",
        items: [
          { id: "1", name: "b", role: "a" },
          { id: "2", name: "a", role: "b" },
        ],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
          defaultSortColumnId: "name",
          defaultSortDirection: "desc",
        }),
      },
    });
    expect(screen.getByTestId("sort-indicator-name").textContent).toBe("▼");
  });

  it("ignores invalid default sort column settings", () => {
    render(BaseDataTable, {
      props: {
        title: "DS invalid",
        items: [
          { id: "1", name: "b", role: "a" },
          { id: "2", name: "a", role: "b" },
        ],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
          defaultSortColumnId: "missing-column",
          defaultSortDirection: "desc",
        }),
      },
    });
    expect(screen.queryByTestId("sort-indicator-name")).toBeNull();
  });

  it("hides sort buttons when allowSort is false", () => {
    render(BaseDataTable, {
      props: {
        title: "NS",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowSort: false,
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(screen.queryByRole("button", { name: "Name" })).toBeNull();
  });

  it("opens modal from View all", async () => {
    render(BaseDataTable, {
      props: {
        title: "M",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "modal",
          allowPaging: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    await tick();
    expect(screen.getByText("All M")).toBeTruthy();
  });

  it("hides modal control when allowModal is false", () => {
    render(BaseDataTable, {
      props: {
        title: "NM",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "modal",
          allowModal: false,
          allowPaging: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(screen.queryByRole("button", { name: "View all" })).toBeNull();
  });

  it("invokes onRefresh from toolbar", async () => {
    const onRefresh = vi.fn();
    render(BaseDataTable, {
      props: {
        title: "R",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        onRefresh,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowRefresh: true,
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refresh table data" }));
    await tick();
    expect(onRefresh).toHaveBeenCalled();
  });

  it("paginates with next page", async () => {
    render(BaseDataTable, {
      props: {
        title: "P",
        items: manyItems(15),
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          { id: "name", header: "Name", accessor: (r) => (r as { name: string }).name },
          { id: "role", header: "Role", accessor: (r) => (r as { role: string }).role },
        ],
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          autoPageSize: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 2" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
  });

  it("uses configured pageSize when autoPageSize is false", async () => {
    render(BaseDataTable, {
      props: {
        title: "PS",
        items: manyItems(15),
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          autoPageSize: false,
          pageSize: 7,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 2" }).getAttribute("aria-current")).toBe("page");
  });

  it("applies rowHeightMode classes to body cells", () => {
    const { container, unmount } = render(BaseDataTable, {
      props: {
        title: "RH compact",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          rowHeightMode: "compact",
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(container.querySelector("tbody td")?.className).toContain("py-1");
    unmount();

    const { container: normalContainer, unmount: unmountNormal } = render(BaseDataTable, {
      props: {
        title: "RH normal",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          rowHeightMode: "normal",
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(normalContainer.querySelector("tbody td")?.className).toContain("py-2");
    unmountNormal();

    const { container: largeContainer } = render(BaseDataTable, {
      props: {
        title: "RH large",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          rowHeightMode: "large",
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(largeContainer.querySelector("tbody td")?.className).toContain("py-3");
  });

  it("surfaces JSON export failure", async () => {
    const te = await import("./tableExport");
    const spy = vi.spyOn(te, "triggerDownload").mockImplementation(() => {
      throw new Error("disk full");
    });
    render(BaseDataTable, {
      props: {
        title: "X",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open export options" }));
    await tick();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export JSON" }));
    await tick();
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain("disk full");
    spy.mockRestore();
  });

  it("surfaces CSV export failure", async () => {
    const te = await import("./tableExport");
    const spy = vi.spyOn(te, "triggerDownload").mockImplementation(() => {
      throw new Error("no space");
    });
    render(BaseDataTable, {
      props: {
        title: "Y",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open export options" }));
    await tick();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export CSV" }));
    await tick();
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain("no space");
    spy.mockRestore();
  });

  it("uses custom title id and compact json export", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(BaseDataTable, {
      props: {
        title: "J",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        titleDomId: "my-table-title",
        jsonPrettyExport: false,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
        }),
      },
    });
    expect(document.getElementById("my-table-title")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    await tick();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("exports csv", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(BaseDataTable, {
      props: {
        title: "C",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open export options" }));
    await tick();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export CSV" }));
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await tick();
    expect(clickSpy).toHaveBeenCalledTimes(2);
    clickSpy.mockRestore();
  });

  it("uses fixedHeader false scroll mode", () => {
    const { container } = render(BaseDataTable, {
      props: {
        title: "FH",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          fixedHeader: false,
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    const scroll = container.querySelector('[data-testid="table-body-scroll"]');
    expect(scroll?.className).toContain("overflow-y-auto");
  });

  it("exports all rows when exportScope is all", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(BaseDataTable, {
      props: {
        title: "All",
        items: [
          { id: "1", name: "Ada", role: "r" },
          { id: "2", name: "Bob", role: "r" },
        ],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          exportScope: "all",
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open export options" }));
    await tick();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export CSV" }));
    await tick();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("renders compact summary snippet", () => {
    render(BaseDataTableHarness, { props: { variant: "compactSummary" } });
    expect(screen.getByTestId("harness-compact-summary")).toBeTruthy();
  });

  it("renders full single snippet", () => {
    render(BaseDataTableHarness, { props: { variant: "fullSingle" } });
    expect(screen.getByTestId("harness-full-single")).toBeTruthy();
  });

  it("renders cell snippet column", () => {
    render(BaseDataTableHarness, { props: { variant: "cellSnippet" } });
    expect(screen.getByTestId("snip-cell").textContent?.trim()).toBe("row-a");
  });

  it("clamps page index when the row set shrinks", async () => {
    render(BaseDataTablePageClampHarness);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 2" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByTestId("shrink-items"));
    await tick();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    expect(screen.getByText("u4")).toBeTruthy();
  });

  it("uses configured pageSize and disables inner scrolling in paging mode", async () => {
    render(BaseDataTable, {
      props: {
        title: "RO",
        items: manyItems(40),
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          { id: "name", header: "Name", accessor: (r) => (r as { name: string }).name },
          { id: "role", header: "Role", accessor: (r) => (r as { role: string }).role },
        ],
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          autoPageSize: true,
          pageSize: 8,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    await tick();
    const scroller = document.querySelector('[data-testid="table-body-scroll"]');
    expect(scroller?.className).toContain("overflow-hidden");
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
    expect((screen.getByRole("combobox", { name: "Rows per page" }) as HTMLSelectElement).value).toBe("8");
  });

  it("navigates pagination controls forward and backward", async () => {
    render(BaseDataTable, {
      props: {
        title: "Pager",
        items: manyItems(11),
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          pageSize: 5,
          allowFilter: false,
          allowModal: false,
          interactionMode: "modal",
        }),
      },
    });
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 2" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
  });

  it("jumps to entered page from footer input", async () => {
    render(BaseDataTable, {
      props: {
        title: "Pager jump",
        items: manyItems(41),
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          pageSize: 10,
          allowFilter: false,
          allowModal: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    const jump = screen.getByRole("textbox", { name: "Go to page, between 1 and 5" }) as HTMLInputElement;
    jump.value = "4";
    fireEvent.input(jump);
    fireEvent.keyDown(jump, { key: "Enter" });
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 4" }).getAttribute("aria-current")).toBe("page");
  });

  it("clears non-numeric page jump input on enter", async () => {
    render(BaseDataTable, {
      props: {
        title: "Pager jump invalid",
        items: manyItems(41),
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          pageSize: 10,
          allowFilter: false,
          allowModal: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    const jump = screen.getByRole("textbox", { name: "Go to page, between 1 and 5" }) as HTMLInputElement;
    jump.value = "abc";
    fireEvent.input(jump);
    fireEvent.keyDown(jump, { key: "Enter" });
    await tick();
    expect(jump.value).toBe("");
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
  });

  it("changes page size using footer selector", async () => {
    render(BaseDataTable, {
      props: {
        title: "Pager size",
        items: manyItems(60),
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          pageSize: 10,
          allowFilter: false,
          allowModal: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(screen.getByRole("button", { name: "Go to page 6" })).toBeTruthy();
    const pageSizeSelect = screen.getByRole("combobox", { name: "Rows per page" }) as HTMLSelectElement;
    pageSizeSelect.value = "25";
    fireEvent.change(pageSizeSelect);
    await tick();
    expect(screen.queryByRole("button", { name: "Go to page 6" })).toBeNull();
    expect(screen.getByRole("button", { name: "Go to page 3" })).toBeTruthy();
  });

  it("toggles between paged and all rows in inline mode", async () => {
    render(BaseDataTable, {
      props: {
        title: "Inline",
        items: manyItems(12),
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          pageSize: 5,
          interactionMode: "inline",
          allowModal: false,
        }),
      },
    });
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    await tick();
    expect(screen.getByRole("button", { name: "Show paged" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show paged" }));
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBe("page");
  });

  it("edits inline and saves all changed rows in inline mode", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTable, {
      props: {
        title: "Inline edit",
        items: [
          { id: "1", name: "a", role: "r1" },
          { id: "2", name: "b", role: "r2" },
        ],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          { id: "name", header: "Name", fieldKey: "name", accessor: (r) => (r as { name: string }).name, editable: true, editor: "text" },
          { id: "role", header: "Role", accessor: (r) => (r as { role: string }).role },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const inputA = screen.getByDisplayValue("a") as HTMLInputElement;
    inputA.value = "a2";
    fireEvent.input(inputA);
    const inputB = screen.getByDisplayValue("b") as HTMLInputElement;
    inputB.value = "b2";
    fireEvent.input(inputB);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await tick();
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2));
  });

  it("shows inline save error when commit rejects", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("save failed"));
    render(BaseDataTable, {
      props: {
        title: "Inline error",
        items: [{ id: "1", name: "a", role: "r1" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          { id: "name", header: "Name", fieldKey: "name", accessor: (r) => (r as { name: string }).name, editable: true, editor: "text" },
          { id: "role", header: "Role", accessor: (r) => (r as { role: string }).role },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const inputA = screen.getByDisplayValue("a") as HTMLInputElement;
    inputA.value = "a2";
    fireEvent.input(inputA);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await tick();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("save failed"));
  });

  it("blocks inline save when validation fails", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTable, {
      props: {
        title: "Inline validation",
        items: [{ id: "1", name: "abc", role: "r1" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "name",
            header: "Name",
            fieldKey: "name",
            accessor: (r) => (r as { name: string }).name,
            editable: true,
            editor: "text",
            zodSchema: z.string().min(4),
          },
          { id: "role", header: "Role", accessor: (r) => (r as { role: string }).role },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const inputA = screen.getByDisplayValue("abc") as HTMLInputElement;
    inputA.value = "x";
    fireEvent.input(inputA);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await tick();
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/String must contain at least 4 character/i)).toBeTruthy();
  });

  it("clears an inline field error when user edits that field", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTable, {
      props: {
        title: "Inline error clear",
        items: [{ id: "1", name: "abc", role: "r1" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "name",
            header: "Name",
            fieldKey: "name",
            accessor: (r) => (r as { name: string }).name,
            editable: true,
            editor: "text",
            zodSchema: z.string().min(4),
          },
          { id: "role", header: "Role", accessor: (r) => (r as { role: string }).role },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const inputA = screen.getByDisplayValue("abc") as HTMLInputElement;
    inputA.value = "x";
    fireEvent.input(inputA);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await tick();
    expect(screen.getByText(/String must contain at least 4 character/i)).toBeTruthy();
    inputA.value = "abcd";
    fireEvent.input(inputA);
    await tick();
    expect(screen.queryByText(/String must contain at least 4 character/i)).toBeNull();
  });

  it("uses setPatchValue when building inline row patch", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTable, {
      props: {
        title: "Inline setPatchValue",
        items: [{ id: "1", name: "Ada", role: "admin" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "name",
            header: "Name",
            fieldKey: "name",
            accessor: (r) => (r as { name: string }).name,
            editable: true,
            editor: "text",
            setPatchValue: (patch, value) => {
              patch.profile = { displayName: String(value) };
            },
          },
          { id: "role", header: "Role", accessor: (r) => (r as { role: string }).role },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const input = screen.getByDisplayValue("Ada") as HTMLInputElement;
    input.value = "Grace";
    fireEvent.input(input);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith({
        rowId: "1",
        patch: { profile: { displayName: "Grace" } },
      }),
    );
  });

  it("edits select and number inline fields and saves via Save row", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTable, {
      props: {
        title: "Inline typed editors",
        items: [{ id: "1", status: "up", count: 1 }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "status",
            header: "Status",
            fieldKey: "status",
            accessor: (r) => (r as { status: string }).status,
            editable: true,
            editor: "select",
            options: [
              { value: "up", label: "Up" },
              { value: "down", label: "Down" },
            ],
          },
          {
            id: "count",
            header: "Count",
            fieldKey: "count",
            accessor: (r) => String((r as { count: number }).count),
            editable: true,
            editor: "number",
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    select.value = "down";
    fireEvent.change(select);
    const numberInput = screen.getByRole("spinbutton") as HTMLInputElement;
    numberInput.value = "5";
    fireEvent.input(numberInput);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith({
        rowId: "1",
        patch: { status: "down", count: 5 },
      }),
    );
  });

  it("uses header refresh button for minimal modal tables", async () => {
    const onRefresh = vi.fn();
    render(BaseDataTable, {
      props: {
        title: "Header refresh",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        onRefresh,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "modal",
          allowRefresh: true,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
          allowPaging: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refresh table data" }));
    await tick();
    expect(onRefresh).toHaveBeenCalled();
  });

  it("supports placeholder select and empty number inline values", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTable, {
      props: {
        title: "Inline empty numeric",
        items: [{ id: "1", status: "up", count: 7 }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "status",
            header: "Status",
            fieldKey: "status",
            accessor: (r) => (r as { status: string }).status,
            editable: true,
            editor: "select",
            placeholder: "Select status",
            options: [
              { value: "up", label: "Up" },
              { value: "down", label: "Down" },
            ],
          },
          {
            id: "count",
            header: "Count",
            fieldKey: "count",
            accessor: (r) => String((r as { count: number }).count),
            editable: true,
            editor: "number",
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    select.value = "";
    fireEvent.change(select);
    const numberInput = screen.getByRole("spinbutton") as HTMLInputElement;
    numberInput.value = "";
    fireEvent.input(numberInput);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith({
        rowId: "1",
        patch: { status: "", count: "" },
      }),
    );
  });

  it("shows number-editor validation state and inline message", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTable, {
      props: {
        title: "Inline numeric validation",
        items: [{ id: "1", count: 3 }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "count",
            header: "Count",
            fieldKey: "count",
            accessor: (r) => String((r as { count: number }).count),
            editable: true,
            editor: "number",
            validate: (v) => (v === "" ? "Count required" : null),
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const numberInput = screen.getByRole("spinbutton") as HTMLInputElement;
    numberInput.value = "";
    fireEvent.input(numberInput);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await tick();
    expect(numberInput.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Count required")).toBeTruthy();
  });

  it("renders edit inputs as empty when source values are nullish", async () => {
    render(BaseDataTable, {
      props: {
        title: "Inline nullish",
        items: [{ id: "1", text: undefined, count: undefined }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "text",
            header: "Text",
            fieldKey: "text",
            accessor: (r) => String((r as { text?: string }).text ?? ""),
            getEditValue: (r) => (r as { text?: string }).text,
            editable: true,
            editor: "text",
          },
          {
            id: "count",
            header: "Count",
            fieldKey: "count",
            accessor: (r) => String((r as { count?: number }).count ?? ""),
            getEditValue: (r) => (r as { count?: number }).count,
            editable: true,
            editor: "number",
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  it("shows toolbar without refresh button when no refresh handler is provided", () => {
    const { container } = render(BaseDataTable, {
      props: {
        title: "No refresh handler",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "modal",
          allowRefresh: true,
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    expect(container.querySelector('[role="toolbar"]')).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Refresh table data" })).toBeNull();
  });

  it("renders select options including disabled state and field error linkage", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(BaseDataTable, {
      props: {
        title: "Select errors",
        items: [{ id: "1", status: "up" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "status",
            header: "Status",
            fieldKey: "status",
            accessor: (r) => (r as { status: string }).status,
            editable: true,
            editor: "select",
            placeholder: "Choose status",
            options: [
              { value: "up", label: "Up" },
              { value: "down", label: "Down", disabled: true },
            ],
            validate: (v) => (v === "" ? "Status required" : null),
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const disabled = screen.getByRole("option", { name: "Down" }) as HTMLOptionElement;
    expect(disabled.disabled).toBe(true);
    select.value = "";
    fireEvent.change(select);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save row" }));
    await tick();
    expect(select.getAttribute("aria-describedby")).toContain("table-err-1-status");
    expect(screen.getByText("Status required")).toBeTruthy();
  });

  it("renders select values for both null and non-null edit values", async () => {
    render(BaseDataTable, {
      props: {
        title: "Select display values",
        items: [
          { id: "1", status: null },
          { id: "2", status: "up" },
        ],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "status",
            header: "Status",
            fieldKey: "status",
            accessor: (r) => String((r as { status: string | null }).status ?? ""),
            getEditValue: (r) => (r as { status: string | null }).status,
            editable: true,
            editor: "select",
            options: [{ value: "up", label: "Up" }],
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0]?.value).toBe("");
    expect(selects[1]?.value).toBe("up");
  });

  it("renders a select editor when options are present", async () => {
    render(BaseDataTable, {
      props: {
        title: "Select present",
        items: [{ id: "1", status: "up" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "status",
            header: "Status",
            fieldKey: "status",
            accessor: (r) => (r as { status: string }).status,
            editable: true,
            editor: "select",
            options: [{ value: "up", label: "Up" }],
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("reaches the last page label in pagination", async () => {
    render(BaseDataTable, {
      props: {
        title: "Pager end",
        items: manyItems(11),
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: true,
          pageSize: 5,
          allowFilter: false,
          allowModal: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await tick();
    expect(screen.getByRole("button", { name: "Go to page 3" }).getAttribute("aria-current")).toBe("page");
  });

  it("does nothing when save all is clicked without an onCommit handler", async () => {
    render(BaseDataTable, {
      props: {
        title: "No commit",
        items: [{ id: "1", name: "Ada" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "name",
            header: "Name",
            fieldKey: "name",
            accessor: (r) => (r as { name: string }).name,
            editable: true,
            editor: "text",
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    input.value = "Ada2";
    fireEvent.input(input);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await tick();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("surfaces non-Error failures from inline save", async () => {
    const onCommit = vi.fn().mockRejectedValue("save as string");
    render(BaseDataTable, {
      props: {
        title: "Inline string error",
        items: [{ id: "1", name: "a" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "name",
            header: "Name",
            fieldKey: "name",
            accessor: (r) => (r as { name: string }).name,
            editable: true,
            editor: "text",
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        onCommit,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    input.value = "a2";
    fireEvent.input(input);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await tick();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("save as string"));
  });

  it("surfaces non-Error failures from CSV and JSON export", async () => {
    const te = await import("./tableExport");
    const spy = vi.spyOn(te, "triggerDownload").mockImplementation(() => {
      throw "string failure";
    });
    render(BaseDataTable, {
      props: {
        title: "String export fail",
        items: [{ id: "1", name: "Ada", role: "r" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: cols(),
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          allowPaging: false,
          allowModal: false,
          allowFilter: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    await tick();
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain("Export failed");
    fireEvent.click(screen.getByRole("button", { name: "Open export options" }));
    await tick();
    fireEvent.click(screen.getByRole("menuitem", { name: "Export CSV" }));
    await tick();
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain("Export failed");
    spy.mockRestore();
  });

  it("renders select editor with no options as an empty combobox", async () => {
    render(BaseDataTable, {
      props: {
        title: "Select fallback",
        items: [{ id: "1", mode: null }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "mode",
            header: "Mode",
            fieldKey: "mode",
            accessor: (r) => String((r as { mode: string | null }).mode ?? ""),
            getEditValue: () => null,
            editable: true,
            editor: "select",
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("renders select option entries without explicit value/disabled flags", async () => {
    render(BaseDataTable, {
      props: {
        title: "Select option defaults",
        items: [{ id: "1", status: "up" }],
        err: null,
        emptyText: "e",
        compact: false,
        columns: [
          {
            id: "status",
            header: "Status",
            fieldKey: "status",
            accessor: (r) => (r as { status: string }).status,
            editable: true,
            editor: "select",
            options: [{ value: "up", label: "Up" }, { label: "Unknown" } as unknown as { value: string; label: string }],
          },
        ],
        rowKey: (r) => (r as { id: string }).id,
        settings: mergeBaseDataTableSettings(defaultBaseDataTableSettings, {
          interactionMode: "inline",
          allowPaging: false,
          allowModal: false,
          allowEdit: true,
          allowFilter: false,
          allowExportCsv: false,
          allowExportJson: false,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await tick();
    const unknown = screen.getByRole("option", { name: "Unknown" }) as HTMLOptionElement;
    expect(unknown.disabled).toBe(false);
  });
});
