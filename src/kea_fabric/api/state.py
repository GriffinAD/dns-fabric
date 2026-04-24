"""In-memory mutable API state (discovery + perf tick). Layout uses JsonLayoutStore."""

from __future__ import annotations

from datetime import UTC, datetime

from kea_fabric.api.stub_mock_tables import MOCK_DISCOVERY_RECORD_COUNT

_discovery_paused: bool = False
_perf_tick: int = 0


def get_perf_tick() -> int:
    """Last perf tick (0 before first SSE `next_perf_tick`)."""
    return _perf_tick


def get_discovery_scan() -> dict[str, object]:
    state = "paused" if _discovery_paused else "running"
    return {
        "state": state,
        "updated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "record_count": MOCK_DISCOVERY_RECORD_COUNT,
    }


def set_discovery_paused(paused: bool) -> dict[str, object]:
    global _discovery_paused
    _discovery_paused = paused
    return get_discovery_scan()


def next_perf_tick() -> int:
    global _perf_tick
    _perf_tick += 1
    return _perf_tick


def reset_stub_state() -> None:
    """Clear mutable stub state (tests)."""
    global _discovery_paused, _perf_tick
    _discovery_paused = False
    _perf_tick = 0
