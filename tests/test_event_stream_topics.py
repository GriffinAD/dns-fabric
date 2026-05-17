"""SSE topic coverage for the fabric event stream."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from kea_fabric.api import event_stream as event_stream_mod
from kea_fabric.api import state
from kea_fabric.api.event_stream import fabric_sse_lines
from kea_fabric.api.main import create_app
from kea_fabric.settings import ApiSettings


def test_fabric_sse_emits_discovery_and_dhcp_topics(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """One SSE iteration emits perf, discovery scan, and dhcp clients revision."""
    monkeypatch.setenv("KEA_FABRIC_SSE_CLOSE_AFTER_DATA_EVENTS", "3")
    state.reset_stub_state()
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.01)
    with TestClient(create_app(settings=settings)) as client:
        response = client.get("/api/v1/events/stream")
        assert response.status_code == 200
        body = response.content
        assert b"fabric.perf.updated" in body
        assert b"fabric.discovery.scan.updated" in body
        assert b'"state"' in body
        assert b"fabric.dhcp.clients.updated" in body
        assert b'"revision"' in body
    state.reset_stub_state()


def test_sse_close_after_env_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KEA_FABRIC_SSE_CLOSE_AFTER_DATA_EVENTS", "not-int")
    assert event_stream_mod._sse_close_after_data_events() == 0


def test_fabric_sse_stops_after_perf_when_close_after_one(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("KEA_FABRIC_SSE_CLOSE_AFTER_DATA_EVENTS", "1")
    state.reset_stub_state()
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.01)
    with TestClient(create_app(settings=settings)) as client:
        response = client.get("/api/v1/events/stream")
        assert response.status_code == 200
        body = response.content
        assert b"fabric.perf.updated" in body
        assert b"fabric.discovery.scan.updated" not in body
    state.reset_stub_state()


def test_fabric_sse_stops_after_discovery_when_close_after_two(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("KEA_FABRIC_SSE_CLOSE_AFTER_DATA_EVENTS", "2")
    state.reset_stub_state()
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.01)
    with TestClient(create_app(settings=settings)) as client:
        response = client.get("/api/v1/events/stream")
        assert response.status_code == 200
        body = response.content
        assert b"fabric.discovery.scan.updated" in body
        assert b"fabric.dhcp.clients.updated" not in body
    state.reset_stub_state()


def test_fabric_sse_lines_emit_all_topics_each_iteration(tmp_path: Path) -> None:
    async def collect() -> str:
        settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.01)
        request = MagicMock(spec=Request)
        request.app.state.settings = settings
        buf: list[str] = []
        async for line in fabric_sse_lines(request):
            buf.append(line)
            if len(buf) >= 8:
                break
        return "".join(buf)

    state.reset_stub_state()
    joined = asyncio.run(collect())
    assert joined.count("fabric.perf.updated") >= 2
    assert "fabric.discovery.scan.updated" in joined
    assert "fabric.dhcp.clients.updated" in joined
    state.reset_stub_state()
