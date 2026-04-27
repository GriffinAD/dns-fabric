"""Dashboard layout persistence and validation service."""

from __future__ import annotations

import copy
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from kea_fabric.api import layout_validate
from kea_fabric.persistence.layout_store import JsonLayoutStore
from kea_fabric.settings import ApiSettings


class DashboardLayoutService:
    def __init__(self, *, settings: ApiSettings, layout_store: JsonLayoutStore) -> None:
        self._settings = settings
        self._layout_store = layout_store

    def get_layout(self, dashboard_id: str) -> dict[str, Any]:
        layout = self._layout_store.get(dashboard_id)
        if layout is None:
            raise HTTPException(
                status_code=404,
                detail={"title": "layout not found", "status": 404},
            )
        return layout

    def put_layout(self, dashboard_id: str, body: object) -> None:
        if not layout_validate.is_dashboard_layout(body):
            raise HTTPException(
                status_code=400,
                detail={"title": "Invalid layout", "status": 400},
            )
        assert isinstance(body, dict)
        self._layout_store.set(dashboard_id, body)

    def save_layout_to_file(self, dashboard_id: str, body: object) -> dict[str, str]:
        if not layout_validate.is_dashboard_layout(body):
            raise HTTPException(
                status_code=400,
                detail={"title": "Invalid layout", "status": 400},
            )
        assert isinstance(body, dict)
        self._layout_store.set(dashboard_id, body)
        exports_dir = self._settings.data_dir / "dashboard-layout-exports"
        exports_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        path = self._allocate_dashboard_export_path(exports_dir, ts)
        path.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
        return {"filename": path.name}

    @staticmethod
    def _allocate_dashboard_export_path(exports_dir: Path, ts: str) -> Path:
        base = exports_dir / f"Dashboard_Layout_{ts}.json"
        if not base.exists():
            return base
        for n in range(1, 1000):
            candidate = exports_dir / f"Dashboard_Layout_{ts}_{n}.json"
            if not candidate.exists():
                return candidate
        msg = "Could not allocate a unique dashboard export filename"
        raise HTTPException(status_code=500, detail={"title": msg, "status": 500})

    def reset_layout_from_orig(self, dashboard_id: str) -> dict[str, Any]:
        orig_path = self._settings.data_dir / "dashboard-layouts.orig.json"
        if not orig_path.is_file():
            hint = (
                f"Expected {orig_path}. "
                "Set KEA_FABRIC_DATA_DIR to the directory that contains "
                "dashboard-layouts.orig.json (next to dashboard-layouts.json)."
            )
            raise HTTPException(
                status_code=404,
                detail={
                    "title": "baseline layout file not found",
                    "status": 404,
                    "detail": hint,
                },
            )
        try:
            raw = json.loads(orig_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail={
                    "title": "baseline layout file is not valid JSON",
                    "status": 500,
                },
            ) from None
        if not isinstance(raw, dict):
            raise HTTPException(
                status_code=500,
                detail={
                    "title": "baseline layout file must be a JSON object",
                    "status": 500,
                },
            )
        layout = raw.get(dashboard_id)
        layout_ok = isinstance(layout, dict) and layout_validate.is_dashboard_layout(
            layout
        )
        if not layout_ok:
            raise HTTPException(
                status_code=400,
                detail={
                    "title": "Invalid or missing layout in baseline file",
                    "status": 400,
                },
            )
        assert isinstance(layout, dict)
        self._layout_store.set(dashboard_id, layout)
        return copy.deepcopy(layout)
