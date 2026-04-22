import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { applyDocumentTheme, getSystemPrefersDark, loadThemePreferences } from "./lib/theme/themeStorage";

const prefs = loadThemePreferences();
applyDocumentTheme(prefs.mode, prefs.colorPreset, getSystemPrefersDark());

const target = document.getElementById("app");
if (!target) {
  throw new Error("missing #app");
}

mount(App, { target });
