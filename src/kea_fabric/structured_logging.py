"""Global structured logging primitives and query helpers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal, TypedDict, cast

LogLevel = Literal["CRITICAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"]
LOG_LEVELS: tuple[LogLevel, ...] = (
    "CRITICAL",
    "ERROR",
    "WARN",
    "INFO",
    "DEBUG",
    "TRACE",
)


class StructuredLogRecord(TypedDict):
    ts: str
    level: LogLevel
    event: str
    message: str
    service: str
    operation: str
    subcategory: str
    mode: str | None
    request_id: str | None
    trace_id: str | None
    actor: str | None
    error_type: str | None
    error_message: str | None


@dataclass(frozen=True)
class LogsQuery:
    service: str | None = None
    operation: str | None = None
    subcategory: str | None = None
    level: LogLevel | None = None
    mode: str | None = None
    from_ts: str | None = None
    to_ts: str | None = None
    cursor: int = 0
    limit: int = 100


class GlobalStructuredLogger:
    def __init__(self, *, data_dir: Path) -> None:
        self._path = data_dir / "logs" / "system.jsonl"

    @property
    def path(self) -> Path:
        return self._path

    def emit(
        self,
        *,
        level: LogLevel,
        event: str,
        message: str,
        service: str,
        operation: str,
        subcategory: str,
        mode: str | None = None,
        request_id: str | None = None,
        trace_id: str | None = None,
        actor: str | None = None,
        error_type: str | None = None,
        error_message: str | None = None,
    ) -> StructuredLogRecord:
        row: StructuredLogRecord = {
            "ts": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "level": level,
            "event": event,
            "message": message,
            "service": service,
            "operation": operation,
            "subcategory": subcategory,
            "mode": mode,
            "request_id": request_id,
            "trace_id": trace_id,
            "actor": actor,
            "error_type": error_type,
            "error_message": error_message,
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as fp:
            fp.write(json.dumps(row, separators=(",", ":")) + "\n")
        return row

    def query(self, q: LogsQuery) -> dict[str, Any]:
        if not self._path.is_file():
            return {"items": [], "next_cursor": None, "total_count": 0}
        raw_lines = self._path.read_text(encoding="utf-8").splitlines()
        start = max(0, q.cursor)
        selected: list[StructuredLogRecord] = []
        total_count = 0
        from_dt = _parse_ts(q.from_ts)
        to_dt = _parse_ts(q.to_ts)
        matched_seen = 0
        for line in raw_lines:
            try:
                row = cast(StructuredLogRecord, json.loads(line))
            except json.JSONDecodeError:
                continue
            if q.service and row["service"] != q.service:
                continue
            if q.operation and row["operation"] != q.operation:
                continue
            if q.subcategory and row["subcategory"] != q.subcategory:
                continue
            if q.level and row["level"] != q.level:
                continue
            if q.mode and row["mode"] != q.mode:
                continue
            ts = _parse_ts(row["ts"])
            if from_dt and ts and ts < from_dt:
                continue
            if to_dt and ts and ts > to_dt:
                continue
            total_count += 1
            if matched_seen >= start and len(selected) < q.limit:
                selected.append(row)
            matched_seen += 1
        next_cursor = start + len(selected)
        return {
            "items": selected,
            "next_cursor": None if next_cursor >= total_count else next_cursor,
            "total_count": total_count,
        }


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
