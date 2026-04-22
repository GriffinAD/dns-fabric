"""Minimal dashboard layout validation (mirrors apps/ui mock isDashboardLayout)."""

from __future__ import annotations

_HOST = frozenset({"single-panel", "tab-control", "vertical-stack", "split-grid"})
_DISPLAY = frozenset({"compact", "full"})


def _valid_grid_cell(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    g = value
    try:
        col = g["col"]
        row = g["row"]
        cspan = g["colSpan"]
        rspan = g["rowSpan"]
    except KeyError:
        return False
    if not all(isinstance(x, int) for x in (col, row, cspan, rspan)):
        return False
    if not (0 <= col <= 11 and 1 <= cspan <= 12 and col + cspan <= 12):
        return False
    if row < 0 or rspan < 1 or rspan > 12:
        return False
    return True


def is_dashboard_layout(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    v = value
    ver = v.get("version")
    tiles_raw = v.get("tiles")
    if not isinstance(ver, int) or ver < 1:
        return False
    if not isinstance(tiles_raw, list):
        return False
    for t in tiles_raw:
        if not isinstance(t, dict):
            return False
        tile = t
        if not isinstance(tile.get("id"), str) or not tile["id"]:
            return False
        if not isinstance(tile.get("pluginId"), str) or not tile["pluginId"]:
            return False
        hc = tile.get("hostControl")
        dm = tile.get("displayMode")
        if not isinstance(hc, str) or hc not in _HOST:
            return False
        if not isinstance(dm, str) or dm not in _DISPLAY:
            return False
        grid = tile.get("grid")
        if grid is not None and not _valid_grid_cell(grid):
            return False
    return True
