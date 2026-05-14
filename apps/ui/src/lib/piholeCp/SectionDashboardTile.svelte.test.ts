import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import SectionDashboardTile from "./SectionDashboardTile.svelte";

describe("SectionDashboardTile", () => {
  it("renders HA environment as key/value rows", () => {
    render(SectionDashboardTile, {
      props: {
        section: "ha",
        title: "HA environment",
        payload: {
          ok: true,
          vip: "192.168.2.2",
          router: "192.168.2.1",
          node_primary_ip: "192.168.2.3",
          dhcp_mode: "none",
          dnscrypt_enabled: false,
        },
      },
    });
    expect(screen.getByRole("heading", { name: "HA environment" })).toBeTruthy();
    expect(screen.getByText("192.168.2.2")).toBeTruthy();
    expect(screen.getByText("VIP")).toBeTruthy();
  });

  it("falls back to JSON for unknown section ids", () => {
    render(SectionDashboardTile, {
      props: {
        section: "future_section",
        title: "Future",
        payload: { foo: 1 },
      },
    });
    expect(screen.getByText(/raw section/i)).toBeTruthy();
    expect(screen.getByText(/"foo": 1/)).toBeTruthy();
  });
});
