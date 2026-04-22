"""JSON file store for dashboard layouts (per dashboard id).

Writes only ``dashboard-layouts.json`` (the path passed to the store).
Baseline snapshots live in ``dashboard-layouts.orig.json`` and are never
written by this module; see ``FabricService.reset_layout_from_orig``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class JsonLayoutStore:
    """Persists a map of dashboard_id -> layout document under ``data_dir``."""

    def __init__(self, file_path: Path) -> None:
        self._path = file_path

    def _ensure_parent(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def _load_all(self) -> dict[str, Any]:
        if not self._path.is_file():
            return {}
        raw = self._path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            return {}
        return data

    def get(self, dashboard_id: str) -> dict[str, Any] | None:
        doc = self._load_all().get(dashboard_id)
        return doc if isinstance(doc, dict) else None

    def set(self, dashboard_id: str, layout: dict[str, Any]) -> None:
        self._ensure_parent()
        all_docs = self._load_all()
        all_docs[dashboard_id] = layout
        self._path.write_text(json.dumps(all_docs, indent=2), encoding="utf-8")

    def clear_dashboard(self, dashboard_id: str) -> None:
        if not self._path.is_file():
            return
        all_docs = self._load_all()
        all_docs.pop(dashboard_id, None)
        if not all_docs:
            self._path.unlink(missing_ok=True)
        else:
            self._path.write_text(json.dumps(all_docs, indent=2), encoding="utf-8")

    def clear_all(self) -> None:
        self._path.unlink(missing_ok=True)
