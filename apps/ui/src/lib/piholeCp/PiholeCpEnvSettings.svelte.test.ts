import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import PiholeCpEnvSettings from "./PiholeCpEnvSettings.svelte";

describe("PiholeCpEnvSettings", () => {
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
});
