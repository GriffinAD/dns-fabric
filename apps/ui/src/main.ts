import "./app.css";
import {
  applyDocumentDashboardSettings,
  loadDashboardSettings,
} from "./lib/dashboard/dashboardSettings";
import { applyDocumentTheme, getSystemPrefersDark, loadThemePreferences } from "./lib/theme/themeStorage";

const prefs = loadThemePreferences();
applyDocumentTheme(
  prefs.mode,
  prefs.colorPreset,
  getSystemPrefersDark(),
  prefs.gaugeCapStyle,
  prefs.gaugeSegmentEnabled,
  prefs.gaugeSegmentDivisions,
  prefs.gaugeSegmentGapPx,
);

applyDocumentDashboardSettings(loadDashboardSettings());

const el = document.getElementById("app");
if (!el) {
  throw new Error("missing #app");
}
const target: HTMLElement = el;

/**
 * Kea Fabric: dynamic-import the app so failures (including in IDE embedded browsers) show
 * text in #app instead of a blank screen when the entry module or Svelte throws.
 */
function showBootFailure(e: unknown) {
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

void (async () => {
  try {
    if (import.meta.env.VITE_E2E_THROWING === "1") {
      const [{ registerDynamicPluginResolver }, { default: E2EThrowingTile }] = await Promise.all([
        import("./lib/plugins/registry"),
        import("./lib/plugins/E2EThrowingTile.svelte"),
      ]);
      registerDynamicPluginResolver("e2e.throwing", () => ({
        component: E2EThrowingTile,
        props: {},
      }));
    }
    const [{ mount }, { default: App }] = await Promise.all([import("svelte"), import("./App.svelte")]);
    // `mount` appends to `target` and does not clear it — remove index.html "Loading…" first.
    target.replaceChildren();
    mount(App, { target });
  } catch (e) {
    showBootFailure(e);
  }
})();
