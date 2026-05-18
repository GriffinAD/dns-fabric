import type { Page } from "@playwright/test";

/**
 * Fire HTML5 drag events with a sveltednd JSON payload. Playwright `dragTo` does not reliably
 * drive @thisux/sveltednd drops; this matches the library's `text/plain` dragData contract.
 */
export async function simulateSveltedndDrop(
  page: Page,
  sourceSelector: string,
  handleSelector: string,
  targetSelector: string,
  dragData: { k: string; i?: string; g?: string },
  dropBand: "before" | "center" | "after" = "center",
): Promise<void> {
  const dragDataJson = JSON.stringify(dragData);
  await page.evaluate(
    ({ sourceSelector, handleSelector, targetSelector, dragDataJson, dropBand }) => {
      const source = document.querySelector<HTMLElement>(sourceSelector);
      const handle = document.querySelector<HTMLElement>(handleSelector);
      const target = document.querySelector<HTMLElement>(targetSelector);
      if (!source || !handle || !target) {
        throw new Error("simulateSveltedndDrop: missing source, handle, or target");
      }
      const rect = target.getBoundingClientRect();
      const cx =
        dropBand === "before"
          ? rect.left + 12
          : dropBand === "after"
            ? rect.right - 12
            : rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const gripRect = handle.getBoundingClientRect();
      const px = gripRect.left + gripRect.width / 2;
      const py = gripRect.top + gripRect.height / 2;
      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: px,
          clientY: py,
          pointerId: 1,
          pointerType: "mouse",
          buttons: 1,
        }),
      );
      const dt = new DataTransfer();
      dt.setData("text/plain", dragDataJson);
      dt.effectAllowed = "copy";
      source.dispatchEvent(
        new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: px, clientY: py }),
      );
      for (const type of ["dragenter", "dragover"] as const) {
        const ev = new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: cx,
          clientY: cy,
        });
        target.dispatchEvent(ev);
        document.dispatchEvent(ev);
      }
      target.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy }),
      );
      source.dispatchEvent(
        new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy }),
      );
    },
    { sourceSelector, handleSelector, targetSelector, dragDataJson, dropBand },
  );
}
