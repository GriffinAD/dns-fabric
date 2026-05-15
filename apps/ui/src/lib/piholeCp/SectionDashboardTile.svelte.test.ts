import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import SectionDashboardTile from "./SectionDashboardTile.svelte";

describe("SectionDashboardTile", () => {
  it("renders HA network slice without DHCP mode row", () => {
    render(SectionDashboardTile, {
      props: {
        section: "ha",
        title: "HA — VIP & nodes",
        view: "ha_network",
        payload: {
          ok: true,
          vip: "192.168.2.2",
          router: "192.168.2.1",
          node_primary_ip: "192.168.2.3",
          dhcp_mode: "none",
        },
      },
    });
    expect(screen.getByText("VIP")).toBeTruthy();
    expect(screen.queryByText("DHCP mode")).toBeNull();
  });

  it("renders peer telemetry hint and link when URL present", () => {
    render(SectionDashboardTile, {
      props: {
        section: "peer_telemetry",
        title: "Performance",
        payload: {
          ok: true,
          detail: "Use fabric for gauges.",
          peer_ui_base_url: "https://fabric.example/",
        },
      },
    });
    expect(screen.getByText(/Use fabric for gauges/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /open fabric peer ui/i });
    expect(link.getAttribute("href")).toBe("https://fabric.example/");
  });

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

  it("docker omits not_found rows and shows a single lifecycle label", () => {
    render(SectionDashboardTile, {
      props: {
        section: "docker",
        title: "Core",
        payload: {
          ok: true,
          containers: [
            { name: "pihole", status: "running", running: true, health: "healthy" },
            { name: "kea-dhcp4", status: "not_found" },
          ],
        },
      },
    });
    expect(screen.getByText("pihole")).toBeTruthy();
    expect(screen.getByText("running")).toBeTruthy();
    expect(screen.queryByText("kea-dhcp4")).toBeNull();
    expect(screen.queryByText("not_found")).toBeNull();
  });

  it("docker shows uptime when started_at is present for a running container", () => {
    const started = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    render(SectionDashboardTile, {
      props: {
        section: "docker",
        title: "Core",
        payload: {
          ok: true,
          containers: [{ name: "pihole", status: "running", started_at: started }],
        },
      },
    });
    expect(screen.getByText(/up 3m/i)).toBeTruthy();
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
