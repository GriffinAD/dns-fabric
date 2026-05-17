import "./app.css";
import "@thisux/sveltednd";
import {
  applyDocumentDashboardSettings,
  loadDashboardSettings,
} from "./lib/dashboard/dashboardSettings";
import { mountOperatorApp } from "./lib/operatorBoot";
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
void mountOperatorApp(el);
