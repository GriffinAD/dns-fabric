import { waitFor } from "@testing-library/dom";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";

import SemicircleGauge from "./SemicircleGauge.svelte";

function resetGaugeDataAttrs() {
  const root = document.documentElement;
  root.classList.remove("dark");
  root.dataset.colorPreset = "default";
  root.dataset.gaugeCapStyle = "flat";
  root.dataset.gaugeSegmentDivisions = "0";
  root.dataset.gaugeSegmentLines = "0";
  root.dataset.gaugeSegmentGap = "0.15";
  delete root.dataset.gaugeSegmentGapPx;
}

function setSegmentedGaugeDataAttrs(divisions: number, gap: string) {
  const root = document.documentElement;
  root.dataset.gaugeSegmentDivisions = String(divisions);
  root.dataset.gaugeSegmentLines = divisions > 0 ? "1" : "0";
  root.dataset.gaugeSegmentGap = gap;
  delete root.dataset.gaugeSegmentGapPx;
}

beforeEach(() => {
  resetGaugeDataAttrs();
});

describe("SemicircleGauge", () => {
  it("uses a single track when segment divisions are off", () => {
    resetGaugeDataAttrs();
    const { container } = render(SemicircleGauge, {
      props: { percent: 40, gradientMode: "smooth" },
    });
    const tracks = container.querySelectorAll('path[stroke="var(--gauge-track-rest)"]');
    expect(tracks.length).toBe(1);
  });

  it("renders safe percent text", () => {
    render(SemicircleGauge, { props: { percent: 42.25 } });
    expect(screen.getByText("42.3%")).toBeTruthy();
  });

  it("treats non-finite percent as 0", () => {
    render(SemicircleGauge, { props: { percent: Number.NaN } });
    expect(screen.getByText("0.0%")).toBeTruthy();
  });

  it("shows label when provided", () => {
    render(SemicircleGauge, { props: { label: "CPU", percent: 1 } });
    expect(screen.getByText("CPU")).toBeTruthy();
  });

  it("uses aria-label when label is blank", () => {
    render(SemicircleGauge, { props: { labelBlank: true, percent: 3.3 } });
    expect(screen.getByLabelText("Gauge 3.3 percent")).toBeTruthy();
  });

  it("renders non-mini sublabel as a paragraph", () => {
    render(SemicircleGauge, { props: { percent: 1, sublabel: "hint" } });
    expect(screen.getByText("hint")).toBeTruthy();
  });

  it("renders mini sublabel truncated line", () => {
    render(SemicircleGauge, { props: { mini: true, percent: 2, sublabel: "mini hint" } });
    const el = screen.getByTitle("mini hint");
    expect(el.textContent?.trim()).toBe("mini hint");
  });

  it("renders mini without sublabel (spacer only)", () => {
    const { container } = render(SemicircleGauge, { props: { mini: true, percent: 5 } });
    expect(container.querySelector("p")).toBeNull();
  });

  it("uses miniFillCell label sizing when mini", () => {
    const { container } = render(SemicircleGauge, {
      props: { mini: true, miniFillCell: true, label: "L", percent: 9 },
    });
    const span = container.querySelector("span.block");
    expect(span?.className).toContain("w-full");
  });

  it("uses miniFillCell classes for labelBlank header row", () => {
    const { container } = render(SemicircleGauge, {
      props: { labelBlank: true, mini: true, miniFillCell: true, percent: 1 },
    });
    const spans = [...container.querySelectorAll("span")];
    const spacer = spans.find(
      (s) =>
        s.className.includes("min-h-") && s.className.includes("w-full max-w-full"),
    );
    expect(spacer).toBeTruthy();
  });

  it("uses non-fillCell mini width for labelBlank header row", () => {
    const { container } = render(SemicircleGauge, {
      props: { labelBlank: true, mini: true, miniFillCell: false, percent: 1 },
    });
    const span = container.querySelector("span");
    expect(span?.className).toContain("max-w-[4.75rem]");
  });

  it("uses non-fillCell mini width for a text label", () => {
    const { container } = render(SemicircleGauge, {
      props: { label: "Z", mini: true, percent: 1 },
    });
    const span = container.querySelector("span.truncate");
    expect(span?.className).toContain("max-w-[4.75rem]");
  });

  it("renders banded progress paths", () => {
    const { container } = render(SemicircleGauge, {
      props: { percent: 95, gradientMode: "banded" },
    });
    const stroked = [...container.querySelectorAll("path[stroke-width]")];
    expect(stroked.length).toBeGreaterThan(1);
    expect(stroked.some((p) => p.getAttribute("class")?.includes("stroke-"))).toBe(true);
  });

  it("uses discrete arc tracks when document sets segment divisions", () => {
    setSegmentedGaugeDataAttrs(4, "0.2");
    const { container } = render(SemicircleGauge, {
      props: { percent: 60, gradientMode: "smooth" },
    });
    const tracks = container.querySelectorAll(
      'path[stroke="var(--gauge-track-rest)"]',
    );
    expect(tracks.length).toBe(4);
  });

  it("uses per-arc-cell smooth fill segments when segments are enabled", async () => {
    setSegmentedGaugeDataAttrs(4, "0.2");
    const { container } = render(SemicircleGauge, {
      props: { percent: 50, gradientMode: "smooth" },
    });
    await tick();
    await waitFor(() => {
      expect(
        container.querySelector("linearGradient[id*=\"cell-0\"]"),
      ).toBeTruthy();
    });
  });

  it("applies banded progress per block when segment divisions are on", async () => {
    setSegmentedGaugeDataAttrs(4, "0.2");
    const { container } = render(SemicircleGauge, {
      props: { percent: 50, gradientMode: "banded" },
    });
    await tick();
    await waitFor(() => {
      const banded = container.querySelector('path[stroke-width][class*="stroke-"]');
      expect(banded).toBeTruthy();
    });
  });

  it("uses text-xs for the percent readout in mini mode", () => {
    const { container } = render(SemicircleGauge, {
      props: { mini: true, percent: 3.1 },
    });
    const readout = container.querySelector("span.font-mono");
    expect(readout?.className).toContain("text-xs");
  });

  it("updates stroke-linecap when document gauge cap style changes", async () => {
    const { container } = render(SemicircleGauge, {
      props: { percent: 50, gradientMode: "banded" },
    });
    const caps = () =>
      [...container.querySelectorAll("path[stroke-linecap]")].map((p) =>
        p.getAttribute("stroke-linecap"),
      );
    expect(caps().every((c) => c === "butt")).toBe(true);
    document.documentElement.dataset.gaugeCapStyle = "rounded";
    await waitFor(() => {
      expect(caps().every((c) => c === "round")).toBe(true);
    });
  });

  it("reads segment gap from legacy data-gauge-segment-gap-px when set", async () => {
    setSegmentedGaugeDataAttrs(6, "0.1");
    delete document.documentElement.dataset.gaugeSegmentGap;
    document.documentElement.dataset.gaugeSegmentGapPx = "0.5";
    const { container } = render(SemicircleGauge, {
      props: { percent: 10, gradientMode: "smooth" },
    });
    await waitFor(() => {
      expect(
        container.querySelector('path[stroke^="url(#"]'),
      ).toBeTruthy();
    });
  });

  it("renders smooth gradient defs for non-zero fill", () => {
    const { container } = render(SemicircleGauge, {
      props: { percent: 88, gradientMode: "smooth" },
    });
    expect(container.querySelector("linearGradient stop")).toBeTruthy();
  });

  it("uses default size viewBox when not compact", () => {
    const { container } = render(SemicircleGauge, {
      props: { percent: 1 },
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toMatch(/-11 -11 182 122/);
  });

  it("enables compact dimensions", () => {
    const { container } = render(SemicircleGauge, {
      props: { percent: 1, compact: true },
    });
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toMatch(/134\s+92/);
  });
});
