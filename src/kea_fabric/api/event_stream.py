"""Server-sent event payloads for live fabric topics."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from fastapi import Request

from kea_fabric.api import state
from kea_fabric.api.perf_simulate import perf_summary_for_tick
from kea_fabric.settings import ApiSettings

_log = logging.getLogger(__name__)


def _sse_close_after_data_events() -> int:
    """If > 0 (tests), end the stream after this many data events."""
    raw = os.environ.get("KEA_FABRIC_SSE_CLOSE_AFTER_DATA_EVENTS", "").strip()
    if not raw:
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


async def fabric_sse_lines(request: Request) -> AsyncIterator[str]:
    """SSE heartbeats and periodic ``fabric.perf.updated`` data until disconnect."""
    settings: ApiSettings = request.app.state.settings
    interval = max(0.05, settings.sse_interval_seconds)
    close_after = _sse_close_after_data_events()
    data_events = 0
    try:
        while True:
            yield ": sse-heartbeat\n\n"
            await asyncio.sleep(interval)
            n = state.next_perf_tick()
            snap = perf_summary_for_tick(n)
            payload = {
                "topic": "fabric.perf.updated",
                "occurred_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                "payload": {**snap, "tick": n},
            }
            yield f"data: {json.dumps(payload)}\n\n"
            data_events += 1
            if close_after and data_events >= close_after:
                return
    except asyncio.CancelledError:
        _log.debug("sse client disconnected")
        raise
