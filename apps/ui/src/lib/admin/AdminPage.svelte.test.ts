import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { DataGateway } from "../dataGateway";
import AdminPage from "./AdminPage.svelte";

describe("AdminPage", () => {
  it("renders logs page for logs subpath", () => {
    const gateway = new DataGateway("");
    vi.spyOn(gateway, "getAdminLogs").mockResolvedValue({ items: [], next_cursor: null });
    render(AdminPage, { props: { gateway, adminSubpath: "logs" } });
    expect(screen.getByTestId("admin-logs-page")).toBeTruthy();
  });

  it("renders registry sample page for ext/sample subpath", () => {
    const gateway = new DataGateway("");
    vi.spyOn(gateway, "getHealth").mockResolvedValue({
      status: "ok",
      checked_at: "2026-01-01T00:00:00Z",
    });
    render(AdminPage, { props: { gateway, adminSubpath: "ext/sample" } });
    expect(screen.getByTestId("admin-registry-sample-page")).toBeTruthy();
  });
});
