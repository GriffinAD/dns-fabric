#!/usr/bin/env python3
"""One-shot import rewriter after dashboard/ Phase 6 folder moves."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "src/lib"
DASH = LIB / "dashboard"

# basename (no ext) -> path under dashboard/ (no leading dashboard/)
MODULE_DIR: dict[str, str] = {
    "types": ".",
    "PluginTileMount": "tiles/PluginTileMount",
    "TileErrorBoundary": "tiles/TileErrorBoundary",
    "TileFallback": "tiles/TileFallback",
    "TileEditChrome": "tiles/TileEditChrome",
    "TileGenericFields": "tiles/TileGenericFields",
    "TileHostControl": "tiles/TileHostControl",
    "TilePlacementForm": "tiles/TilePlacementForm",
    "TileSettingsOverlay": "tiles/TileSettingsOverlay",
    "GroupReadNoWrap": "tiles/GroupReadNoWrap",
    "GroupSettingsOverlay": "tiles/GroupSettingsOverlay",
    "layoutStore": "layout/layoutStore",
    "layoutStorage": "layout/layoutStorage",
    "layoutTree": "layout/layoutTree",
    "layoutZod": "layout/layoutZod",
    "layoutNormalize": "layout/layoutNormalize",
    "layoutDedupe": "layout/layoutDedupe",
    "layoutCompare": "layout/layoutCompare",
    "defaultLayout": "layout/defaultLayout",
    "readModeLayout": "layout/readModeLayout",
    "overlayActions": "layout/overlayActions",
    "tileOptionsZod": "layout/tileOptionsZod",
    "dashboardSettings": "layout/dashboardSettings",
    "stripWidth": "layout/stripWidth",
    "eventBus": "bus/eventBus",
    "DashboardPage": "pages/DashboardPage",
    "DashboardHost": "pages/DashboardHost",
    "DashboardEditRootGrid": "pages/DashboardEditRootGrid",
    "DashboardReadNestedHost": "pages/DashboardReadNestedHost",
    "DashboardControls": "pages/DashboardControls",
    "ShellHeader": "pages/ShellHeader",
    "gridPlacement": "grid/gridPlacement",
    "gridHints": "grid/gridHints",
    "groupDndFinalize": "grid/groupDndFinalize",
    "gaugeGridLayout": "grid/gaugeGridLayout",
    "alignPerfGridAlignment": "grid/alignPerfGridAlignment",
    "dashboardBootstrap": "bootstrap/dashboardBootstrap",
}

GLOBAL: list[tuple[str, str]] = []
for name, sub in MODULE_DIR.items():
    if sub == ".":
        continue
    GLOBAL.append((f"dashboard/{name}.svelte", f"dashboard/{sub}.svelte"))
    GLOBAL.append((f"dashboard/{name}", f"dashboard/{sub}"))
GLOBAL.sort(key=lambda x: -len(x[0]))


def rel_import(from_file: Path, target_sub: str) -> str:
    target = (DASH / target_sub).with_suffix("")
    rel = Path(os_relpath(target, from_file.parent))
    s = rel.as_posix()
    if not s.startswith("."):
        s = "./" + s
    return s


def os_relpath(target: Path, start: Path) -> str:
    import os

    return os.path.relpath(target, start)


IMPORT_RE = re.compile(
    r'(from\s+["\'])(\.\.?/[^"\']+)(["\'])|'
    r'(import\s+["\'])(\.\.?/[^"\']+)(["\'])'
)


def fix_relative_in_dashboard(text: str, from_file: Path) -> str:
    def sub(m: re.Match[str]) -> str:
        prefix, path, suffix = (m.group(1), m.group(2), m.group(3)) if m.group(1) else (m.group(4), m.group(5), m.group(6))
        if path is None:
            return m.group(0)
        base = path.split("/")[-1].removesuffix(".svelte")
        if base not in MODULE_DIR:
            # __fixtures__, editor/, interactions/, persistence/, migration/
            if "/__fixtures__/" in path or path.startswith("./editor/") or path.startswith("../editor/"):
                return m.group(0)
            if "interactions/" in path or "persistence" in path or "migration" in path or "migrations/" in path or "hosts/" in path:
                return m.group(0)
            return m.group(0)
        subpath = MODULE_DIR[base]
        if subpath == ".":
            new = rel_import(from_file, "types")
        else:
            new = rel_import(from_file, subpath)
        return f"{prefix}{new}{suffix}"

    return IMPORT_RE.sub(sub, text)


def process_file(path: Path) -> bool:
    text = path.read_text()
    orig = text
    for old, new in GLOBAL:
        text = text.replace(old, new)
    if path.is_relative_to(DASH):
        text = fix_relative_in_dashboard(text, path)
    if text != orig:
        path.write_text(text)
        return True
    return False


def main() -> None:
    roots = [ROOT / "src", ROOT / "tests"]
    changed: list[str] = []
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.suffix not in (".ts", ".svelte") or "node_modules" in path.parts:
                continue
            if process_file(path):
                changed.append(str(path.relative_to(ROOT)))
    print(f"updated {len(changed)} files")
    for c in changed[:40]:
        print(" ", c)
    if len(changed) > 40:
        print(f"  ... and {len(changed) - 40} more")


if __name__ == "__main__":
    main()
