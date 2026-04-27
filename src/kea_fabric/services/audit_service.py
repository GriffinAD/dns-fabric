"""Append-only mutation audit log for operator actions."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


class AuditLogService:
    def __init__(self, *, data_dir: Path) -> None:
        self._path = data_dir / "audit" / "mutations.jsonl"

    def record(self, action: str, details: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "occurred_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "action": action,
            "details": details,
        }
        with self._path.open("a", encoding="utf-8") as fp:
            fp.write(json.dumps(payload, separators=(",", ":")) + "\n")
