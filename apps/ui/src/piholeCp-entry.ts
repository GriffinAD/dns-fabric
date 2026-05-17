import { mount } from "svelte";

import "./app.css";
import "@thisux/sveltednd";

import PiholeOperatorApp from "./lib/piholeCp/shell/PiholeOperatorApp.svelte";
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

const target = document.getElementById("pihole-cp-app");
if (!target) throw new Error("missing #pihole-cp-app");
mount(PiholeOperatorApp, { target });
