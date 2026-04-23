"""Dashboard layout validation (mirrors apps/ui layoutStorage + layout.schema.json)."""

from __future__ import annotations

from typing import Any

_HOST = frozenset({"single-panel", "tab-control", "vertical-stack", "split-grid"})
_DISPLAY = frozenset({"compact", "full"})
_GROUP_CHILD_INNER_STRIP_MAX_EXTENT = 10_000


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


def _valid_group_child_grid(value: object, *, parent_auto_wrap: bool) -> bool:
    """Group child: auto-wrap uses the root 12 cell; no-wrap allows a long horizontal strip."""
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
    if parent_auto_wrap:
        return _valid_grid_cell(value)
    if not (1 <= cspan <= 12 and col >= 0 and col + cspan <= _GROUP_CHILD_INNER_STRIP_MAX_EXTENT):
        return False
    if row < 0 or rspan < 1 or rspan > 12:
        return False
    return True


def _valid_row_panel(value: object) -> bool:
    if not isinstance(value, str):
        return False
    return 1 <= len(value) <= 64


def _valid_tile_core(
    tile: dict[str, Any], *, inner: bool, group_parent_auto_wrap: bool | None = None
) -> bool:
    if "children" in tile:
        return False
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
    reg = tile.get("region")
    if reg is not None and not isinstance(reg, str):
        return False
    rp = tile.get("rowPanel")
    if rp is not None and not _valid_row_panel(rp):
        return False
    k = tile.get("kind")
    if inner:
        if k == "group":
            return False
        if k is not None and k != "tile":
            return False
    else:
        if k is not None and k not in ("tile",):
            return False
    grid = tile.get("grid")
    if grid is not None:
        if inner and group_parent_auto_wrap is not None:
            if not _valid_group_child_grid(grid, parent_auto_wrap=group_parent_auto_wrap):
                return False
        else:
            if not _valid_grid_cell(grid):
                return False
    return True


def _valid_group(item: dict[str, Any]) -> bool:
    if item.get("kind") != "group":
        return False
    if not isinstance(item.get("id"), str) or not item["id"]:
        return False
    sb = item.get("showBorder")
    if sb is not None and not isinstance(sb, bool):
        return False
    g = item.get("grid")
    if g is not None and not _valid_grid_cell(g):
        return False
    ch = item.get("children")
    if not isinstance(ch, list):
        return False
    parent_auto_wrap = item.get("innerWrap") is True
    for t in ch:
        if not isinstance(t, dict):
            return False
        if not _valid_tile_core(t, inner=True, group_parent_auto_wrap=parent_auto_wrap):
            return False
    return True


def _valid_root_item(item: object) -> bool:
    if not isinstance(item, dict):
        return False
    it = item
    if it.get("kind") == "group":
        return _valid_group(it)
    return _valid_tile_core(it, inner=False)


def _is_layout_v1(v: dict[str, Any]) -> bool:
    tiles_raw = v.get("tiles")
    if not isinstance(tiles_raw, list):
        return False
    for t in tiles_raw:
        if not isinstance(t, dict):
            return False
        if not _valid_tile_core(t, inner=False):
            return False
    return True


def _is_layout_v2(v: dict[str, Any]) -> bool:
    items_raw = v.get("items")
    if not isinstance(items_raw, list):
        return False
    for it in items_raw:
        if not _valid_root_item(it):
            return False
    return True


def is_dashboard_layout(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    v = value
    ver = v.get("version")
    if not isinstance(ver, int) or ver < 1:
        return False
    if ver == 1:
        return _is_layout_v1(v)
    if ver == 2:
        return _is_layout_v2(v)
    return False
