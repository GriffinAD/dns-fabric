"""Dashboard layout validation (mirrors apps/ui layoutStorage + layout.schema.json)."""

from __future__ import annotations

from typing import Any

_HOST = frozenset({"single-panel", "tab-control", "vertical-stack", "split-grid"})
_DISPLAY = frozenset({"compact", "full"})
_GROUP_CHILD_INNER_STRIP_MAX_EXTENT = 10_000
_GRID_COLUMNS = 20
# Must match apps/ui `MAX_DASHBOARD_GROUP_DEPTH` (layoutZod / migration).
_MAX_DASHBOARD_GROUP_DEPTH = 8


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
    if not (
        0 <= col <= _GRID_COLUMNS - 1
        and 1 <= cspan <= _GRID_COLUMNS
        and col + cspan <= _GRID_COLUMNS
    ):
        return False
    if row < 0 or rspan < 1 or rspan > 12:
        return False
    return True


def _valid_group_child_grid(value: object, *, parent_auto_wrap: bool) -> bool:
    """Group child: auto-wrap uses root-width cell; no-wrap allows a long strip."""
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
    strip_ok = col + cspan <= _GROUP_CHILD_INNER_STRIP_MAX_EXTENT
    if not (1 <= cspan <= _GRID_COLUMNS and col >= 0 and strip_ok):
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
            ok = _valid_group_child_grid(
                grid, parent_auto_wrap=group_parent_auto_wrap
            )
            if not ok:
                return False
        else:
            if not _valid_grid_cell(grid):
                return False
    return True


def _valid_group(item: dict[str, Any]) -> bool:
    """v2 root group: children are tiles only (no nested groups)."""
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


def _valid_group_v3(item: dict[str, Any], *, depth: int) -> bool:
    """v3 group: tile or nested group children; innerWrap forbids nested groups."""
    if depth > _MAX_DASHBOARD_GROUP_DEPTH:
        return False
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
    for c in ch:
        if not isinstance(c, dict):
            return False
        if c.get("kind") == "group":
            if parent_auto_wrap:
                return False
            cg = c.get("grid")
            if cg is not None and not _valid_group_child_grid(
                cg, parent_auto_wrap=parent_auto_wrap
            ):
                return False
            if not _valid_group_v3(c, depth=depth + 1):
                return False
        else:
            if not _valid_tile_core(
                c, inner=True, group_parent_auto_wrap=parent_auto_wrap
            ):
                return False
    return True


def _collect_ids_from_children(children: list[Any], into: set[str]) -> bool:
    """Return True if duplicate id found."""
    for c in children:
        if not isinstance(c, dict):
            continue
        cid = c.get("id")
        if isinstance(cid, str) and cid:
            if cid in into:
                return True
            into.add(cid)
        if c.get("kind") == "group":
            ch = c.get("children")
            if isinstance(ch, list) and _collect_ids_from_children(ch, into):
                return True
    return False


def _layout_graph_has_duplicate_ids_v3(items: list[Any]) -> bool:
    seen: set[str] = set()
    for it in items:
        if not isinstance(it, dict):
            continue
        iid = it.get("id")
        if isinstance(iid, str) and iid:
            if iid in seen:
                return True
            seen.add(iid)
        if it.get("kind") == "group":
            ch = it.get("children")
            if isinstance(ch, list) and _collect_ids_from_children(ch, seen):
                return True
    return False


def _max_nested_group_depth_from_children(
    children: list[Any], parent_depth: int
) -> int:
    m = parent_depth
    for c in children:
        if isinstance(c, dict) and c.get("kind") == "group":
            ch = c.get("children")
            d = parent_depth + 1
            m = max(m, d)
            if isinstance(ch, list):
                m = max(m, _max_nested_group_depth_from_children(ch, d))
    return m


def _layout_max_nested_group_depth_v3(items: list[Any]) -> int:
    max_d = 0
    for it in items:
        if isinstance(it, dict) and it.get("kind") == "group":
            ch = it.get("children")
            if isinstance(ch, list):
                max_d = max(
                    max_d,
                    1,
                    _max_nested_group_depth_from_children(ch, 1),
                )
    return max_d


def _valid_root_item_v3(item: object) -> bool:
    if not isinstance(item, dict):
        return False
    it = item
    if it.get("kind") == "group":
        return _valid_group_v3(it, depth=1)
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
        if not isinstance(it, dict):
            return False
        if it.get("kind") == "group":
            if not _valid_group(it):
                return False
        else:
            if not _valid_tile_core(it, inner=False):
                return False
    return True


def _is_layout_v3(v: dict[str, Any]) -> bool:
    items_raw = v.get("items")
    if not isinstance(items_raw, list):
        return False
    for it in items_raw:
        if not _valid_root_item_v3(it):
            return False
    if _layout_graph_has_duplicate_ids_v3(items_raw):
        return False
    if _layout_max_nested_group_depth_v3(items_raw) > _MAX_DASHBOARD_GROUP_DEPTH:
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
    if ver == 3:
        return _is_layout_v3(v)
    return False
