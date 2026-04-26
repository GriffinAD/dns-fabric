/**
 * Operator UI bootstrap (extracted from `main.ts` for unit tests).
 */

import type { Component } from "svelte";

/** Renders a visible error panel into `target` when dynamic import or mount fails. */
export function appendBootFailureUi(target: HTMLElement, e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  const stack = e instanceof Error ? e.stack : "";
  const lines = [msg, stack ? "" : null, stack || null].filter(Boolean) as string[];
  target.replaceChildren();
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "padding:1.25rem;font-family:ui-sans-serif,system-ui,sans-serif;max-width:42rem;color:#111";
  const title = document.createElement("p");
  title.style.cssText = "color:#b91c1c;font-weight:600;margin:0 0 0.5rem 0";
  title.textContent = "Kea Fabric failed to start (JavaScript error).";
  const hint = document.createElement("p");
  hint.style.cssText = "color:#4b5563;font-size:13px;margin:0 0 0.5rem 0";
  hint.textContent =
    "If you use Cursor’s Simple Browser, try a normal browser (Safari/Chrome) or open http://127.0.0.1:5173/";
  const pre = document.createElement("pre");
  pre.style.cssText =
    "white-space:pre-wrap;word-break:break-word;font-size:12px;margin:0;background:#f3f4f6;padding:0.75rem;border-radius:0.25rem";
  pre.textContent = lines.join("\n");
  wrap.append(title, hint, pre);
  target.append(wrap);
}

export type OperatorMountDeps = {
  loadSvelteAndApp: () => Promise<{
    mount: (component: Component, options: { target: HTMLElement }) => unknown;
    App: Component;
  }>;
};

async function defaultLoadSvelteAndApp(): Promise<{
  mount: (component: Component, options: { target: HTMLElement }) => unknown;
  App: Component;
}> {
  const [{ mount }, { default: App }] = await Promise.all([import("svelte"), import("../App.svelte")]);
  return { mount, App: App as Component };
}

export async function mountOperatorApp(
  target: HTMLElement,
  deps: OperatorMountDeps = { loadSvelteAndApp: defaultLoadSvelteAndApp },
): Promise<void> {
  try {
    if (import.meta.env.VITE_E2E_THROWING === "1") {
      const [{ registerDynamicPluginResolver }, { default: E2EThrowingTile }] = await Promise.all([
        import("./plugins/registry"),
        import("./plugins/E2EThrowingTile.svelte"),
      ]);
      registerDynamicPluginResolver("e2e.throwing", () => ({
        component: E2EThrowingTile,
        props: {},
      }));
      (globalThis as typeof globalThis & { __KEA_FABRIC_E2E_THROWING?: boolean }).__KEA_FABRIC_E2E_THROWING =
        true;
    }
    const { mount, App } = await deps.loadSvelteAndApp();
    target.replaceChildren();
    mount(App, { target });
  } catch (e) {
    appendBootFailureUi(target, e);
  }
}
