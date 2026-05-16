import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import * as piholeCpGateway from "./PiholeCpGateway";
import PiholeCpEnvSettings from "./PiholeCpEnvSettings.svelte";

describe("PiholeCpEnvSettings", () => {
  it("loads schema when alwaysOpen without clicking accordion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/schema")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              keys: [
                {
                  key: "DHCP_MODE",
                  tier: 2,
                  type: "string",
                  label: "Dhcp Mode",
                  requires_apply: true,
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            effective: { DHCP_MODE: "none" },
            pending: null,
          }),
        };
      }),
    );
    render(PiholeCpEnvSettings, { props: { baseUrl: "http://127.0.0.1:8091", alwaysOpen: true } });
    expect(await screen.findByText("Dhcp Mode")).toBeTruthy();
  });

  it("loads schema when expanded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/schema")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              keys: [
                {
                  key: "DNSCRYPT_PROXY_ENABLED",
                  tier: 1,
                  type: "boolean",
                  label: "DNSCrypt proxy",
                  requires_apply: true,
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            effective: { DNSCRYPT_PROXY_ENABLED: "0" },
            pending: null,
          }),
        };
      }),
    );
    render(PiholeCpEnvSettings, { props: { baseUrl: "http://127.0.0.1:8091" } });
    fireEvent.click(screen.getByRole("button", { name: /node settings/i }));
    expect(await screen.findByText("DNSCrypt proxy")).toBeTruthy();
  });

  it("sends the token typed in the field on Save, not a stale session value", async () => {
    sessionStorage.setItem("pihole-cp-api-token", "stale-wrong");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/schema")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            keys: [
              {
                key: "DNSCRYPT_PROXY_ENABLED",
                tier: 1,
                type: "boolean",
                label: "DNSCrypt proxy",
                requires_apply: true,
              },
            ],
          }),
        };
      }
      if (String(url).includes("/config/env") && init?.method === "PATCH") {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            staged: { DNSCRYPT_PROXY_ENABLED: "1" },
            pending: { DNSCRYPT_PROXY_ENABLED: "1" },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          effective: { DNSCRYPT_PROXY_ENABLED: "0" },
          pending: null,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(PiholeCpEnvSettings, { props: { baseUrl: "http://127.0.0.1:8091" } });
    fireEvent.click(screen.getByRole("button", { name: /node settings/i }));
    await screen.findByText("DNSCrypt proxy");

    const tokenInput = screen.getByLabelText(/api token/i);
    await fireEvent.input(tokenInput, { target: { value: "correct-secret" } });

    const select = screen.getByRole("combobox");
    await fireEvent.change(select, { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: /save \(stage\)/i }));

    await screen.findByText(/changes staged/i);

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/config/env") && init?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    const headers = patchCall![1]?.headers as Record<string, string>;
    expect(headers["X-Api-Token"]).toBe("correct-secret");
    expect(sessionStorage.getItem("pihole-cp-api-token")).toBe("correct-secret");
  });

  it("shows a loading overlay while Apply is in progress", async () => {
    vi.spyOn(piholeCpGateway, "waitForHostEnvApplyComplete").mockResolvedValue({
      effective: { DNSCRYPT_PROXY_ENABLED: "1" },
      pending: null,
    });

    let releaseApply: (() => void) | undefined;
    let releaseDashboard: (() => void) | undefined;
    const applyGate = new Promise<void>((resolve) => {
      releaseApply = resolve;
    });
    const dashboardGate = new Promise<void>((resolve) => {
      releaseDashboard = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).includes("/schema")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              keys: [
                {
                  key: "DNSCRYPT_PROXY_ENABLED",
                  tier: 1,
                  type: "boolean",
                  label: "DNSCrypt proxy",
                  requires_apply: true,
                },
              ],
            }),
          };
        }
        if (String(url).includes("/mutations/env/apply")) {
          await applyGate;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              kind: "applied",
              policy_ref: "ADR-0053",
              mutation: "mutations.env.apply",
              summary: "Applying .env changes on the host (control plane will restart).",
            }),
          };
        }
        if (String(url).includes("/health")) {
          return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
        }
        if (init?.method === "PATCH") {
          return {
            ok: true,
            status: 202,
            json: async () => ({
              staged: { DNSCRYPT_PROXY_ENABLED: "1" },
              pending: { DNSCRYPT_PROXY_ENABLED: "1" },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            effective: { DNSCRYPT_PROXY_ENABLED: "0" },
            pending: { DNSCRYPT_PROXY_ENABLED: "1" },
          }),
        };
      }),
    );
    sessionStorage.setItem("pihole-cp-api-token", "secret");

    render(PiholeCpEnvSettings, {
      props: {
        baseUrl: "http://127.0.0.1:8091",
        onApplied: async (_report?: (label: string) => void) => {
          await dashboardGate;
        },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /node settings/i }));
    await screen.findByText("DNSCrypt proxy");
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));

    expect(await screen.findByTestId("env-settings-busy")).toBeTruthy();
    expect(screen.getByText(/Submitting apply/i)).toBeTruthy();

    releaseApply!();
    await screen.findByText(/Updating settings and dashboard/i);
    releaseDashboard!();
    await waitFor(() => {
      expect(screen.queryByTestId("env-settings-busy")).toBeNull();
    });
  });
});
