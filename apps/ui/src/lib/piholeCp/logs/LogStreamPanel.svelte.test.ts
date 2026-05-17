import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import LogStreamPanel from "../logs/LogStreamPanel.svelte";

describe("LogStreamPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reloads catalogue when dataRefreshEpoch increments", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        logs: [{ id: "docker_pihole", label: "Pi-hole (container)", kind: "docker_logs" }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(LogStreamPanel, { props: { baseUrl: "", dataRefreshEpoch: 0 } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const n1 = fetchMock.mock.calls.length;
    rerender({ baseUrl: "", dataRefreshEpoch: 1 });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(n1));
  });

  it("loads catalogue and shows stream controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          logs: [{ id: "docker_pihole", label: "Pi-hole (container)", kind: "docker_logs" }],
        }),
      })),
    );
    render(LogStreamPanel, { props: { baseUrl: "" } });
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /stream/i })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
  });

  it("shows catalogue error when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({}),
      })),
    );
    render(LogStreamPanel, { props: { baseUrl: "" } });
    await waitFor(() => {
      expect(screen.getByText(/failed: 502/)).toBeTruthy();
    });
  });

  it("prompts to select stream when catalogue is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ logs: [] }),
      })),
    );
    render(LogStreamPanel, { props: { baseUrl: "" } });
    await waitFor(() => {
      expect(screen.queryByText(/Loading catalogue/)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText(/Select a log stream/)).toBeTruthy();
  });

  it("opens EventSource and appends SSE lines", async () => {
    const mockEs = {
      onmessage: null as null | ((ev: MessageEvent) => void),
      onerror: null as null | (() => void),
      close: vi.fn(),
    };
    const ctor = vi.fn(() => mockEs);
    vi.stubGlobal("EventSource", ctor);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          logs: [{ id: "docker_pihole", label: "Pi-hole (container)", kind: "docker_logs" }],
        }),
      })),
    );
    render(LogStreamPanel, { props: { baseUrl: "http://192.0.2.4:8091" } });
    await waitFor(() => screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(ctor).toHaveBeenCalledWith("http://192.0.2.4:8091/logs/stream/docker_pihole");
    mockEs.onmessage?.({ data: "line-a" } as MessageEvent);
    await waitFor(() => {
      expect(screen.getByText(/line-a/)).toBeTruthy();
    });
  });
});
