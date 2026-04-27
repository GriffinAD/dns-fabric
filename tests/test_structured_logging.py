from __future__ import annotations

import json
from pathlib import Path

from kea_fabric.structured_logging import GlobalStructuredLogger, LogsQuery


def test_emit_and_path(tmp_path: Path) -> None:
    logger = GlobalStructuredLogger(data_dir=tmp_path)
    assert logger.path == tmp_path / "logs" / "system.jsonl"
    row = logger.emit(
        level="INFO",
        event="test.event",
        message="hello",
        service="svc",
        operation="op",
        subcategory="cat",
    )
    assert row["event"] == "test.event"
    assert logger.path.is_file()


def test_query_empty_when_file_missing(tmp_path: Path) -> None:
    logger = GlobalStructuredLogger(data_dir=tmp_path)
    assert logger.query(LogsQuery()) == {"items": [], "next_cursor": None, "total_count": 0}


def test_query_filters_and_cursor(tmp_path: Path) -> None:
    logger = GlobalStructuredLogger(data_dir=tmp_path)
    logger.emit(
        level="DEBUG",
        event="a",
        message="first",
        service="alpha",
        operation="scan",
        subcategory="discovery",
        mode="auto",
    )
    logger.emit(
        level="ERROR",
        event="b",
        message="second",
        service="beta",
        operation="sync",
        subcategory="operation",
        mode="manual",
    )
    filtered = logger.query(
        LogsQuery(
            service="beta",
            operation="sync",
            subcategory="operation",
            level="ERROR",
            mode="manual",
            from_ts="2000-01-01T00:00:00Z",
            to_ts="2999-01-01T00:00:00Z",
            cursor=0,
            limit=1,
        )
    )
    assert len(filtered["items"]) == 1
    assert filtered["items"][0]["service"] == "beta"
    assert filtered["next_cursor"] is None
    assert filtered["total_count"] == 1


def test_query_exercises_filter_continue_paths(tmp_path: Path) -> None:
    logger = GlobalStructuredLogger(data_dir=tmp_path)
    logger.emit(
        level="INFO",
        event="ignore-me",
        message="first",
        service="alpha",
        operation="scan",
        subcategory="discovery",
        mode="auto",
    )
    logger.emit(
        level="INFO",
        event="keep-me",
        message="second",
        service="beta",
        operation="sync",
        subcategory="operation",
        mode="manual",
    )
    service_filtered = logger.query(LogsQuery(service="beta"))
    assert [r["event"] for r in service_filtered["items"]] == ["keep-me"]
    operation_filtered = logger.query(LogsQuery(operation="sync"))
    assert [r["event"] for r in operation_filtered["items"]] == ["keep-me"]
    subcategory_filtered = logger.query(LogsQuery(subcategory="operation"))
    assert [r["event"] for r in subcategory_filtered["items"]] == ["keep-me"]
    mode_filtered = logger.query(LogsQuery(mode="manual"))
    assert [r["event"] for r in mode_filtered["items"]] == ["keep-me"]


def test_query_skips_bad_rows_and_bad_ts_filter(tmp_path: Path) -> None:
    logger = GlobalStructuredLogger(data_dir=tmp_path)
    logger.path.parent.mkdir(parents=True, exist_ok=True)
    logger.path.write_text(
        "\n".join(
            [
                "not-json",
                json.dumps(
                    {
                        "ts": "bad-ts",
                        "level": "INFO",
                        "event": "e1",
                        "message": "m1",
                        "service": "svc",
                        "operation": "op",
                        "subcategory": "cat",
                        "mode": None,
                        "request_id": None,
                        "trace_id": None,
                        "actor": None,
                        "error_type": None,
                        "error_message": None,
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    res = logger.query(LogsQuery(from_ts="bad", to_ts="also-bad", limit=10))
    assert len(res["items"]) == 1
    assert res["next_cursor"] is None
    assert res["total_count"] == 1


def test_query_time_range_filters(tmp_path: Path) -> None:
    logger = GlobalStructuredLogger(data_dir=tmp_path)
    logger.path.parent.mkdir(parents=True, exist_ok=True)
    logger.path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "ts": "2024-01-01T00:00:00Z",
                        "level": "INFO",
                        "event": "old",
                        "message": "m1",
                        "service": "svc",
                        "operation": "op",
                        "subcategory": "cat",
                        "mode": None,
                        "request_id": None,
                        "trace_id": None,
                        "actor": None,
                        "error_type": None,
                        "error_message": None,
                    }
                ),
                json.dumps(
                    {
                        "ts": "2026-01-01T00:00:00Z",
                        "level": "INFO",
                        "event": "new",
                        "message": "m2",
                        "service": "svc",
                        "operation": "op",
                        "subcategory": "cat",
                        "mode": None,
                        "request_id": None,
                        "trace_id": None,
                        "actor": None,
                        "error_type": None,
                        "error_message": None,
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    from_filtered = logger.query(LogsQuery(from_ts="2025-01-01T00:00:00Z"))
    assert [r["event"] for r in from_filtered["items"]] == ["new"]
    assert from_filtered["total_count"] == 1
    to_filtered = logger.query(LogsQuery(to_ts="2025-01-01T00:00:00Z"))
    assert [r["event"] for r in to_filtered["items"]] == ["old"]
    assert to_filtered["total_count"] == 1
