import {
  FEATURE_FLAG_NAMES,
  setFeatureFlag,
} from "svelte-dnd-action";
import { mount } from "svelte";

import "./app.css";

import PiholeOperatorApp from "./lib/piholeCp/PiholeOperatorApp.svelte";

setFeatureFlag(FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, true);

const target = document.getElementById("pihole-cp-app");
if (!target) throw new Error("missing #pihole-cp-app");
mount(PiholeOperatorApp, { target });
