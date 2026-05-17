import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import MetricList from "./MetricList.svelte";

describe("MetricList", () => {
  it("renders each line in order", () => {
    render(MetricList, { props: { lines: ["a", "b"] } });
    const root = screen.getByTestId("metric-list");
    expect(root.tagName).toBe("UL");
    const items = root.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent?.trim()).toBe("a");
    expect(items[1]?.textContent?.trim()).toBe("b");
  });

  it("uses default typography class when class is omitted", () => {
    const { container } = render(MetricList, { props: { lines: ["x"] } });
    const ul = container.querySelector("ul");
    expect(ul?.className).toContain("font-mono");
  });

  it("honours custom class prop", () => {
    const { container } = render(MetricList, {
      props: { lines: ["x"], class: "my-metric-list" },
    });
    expect(container.querySelector("ul.my-metric-list")).toBeTruthy();
  });

  it("renders empty list when lines is empty", () => {
    render(MetricList, { props: { lines: [] } });
    expect(screen.getByTestId("metric-list").querySelectorAll("li")).toHaveLength(0);
  });
});
