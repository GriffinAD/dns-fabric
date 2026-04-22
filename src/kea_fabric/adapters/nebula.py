"""Mock Nebula replication observation (cycles states; no live Nebula)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

NebulaStatus = Literal["healthy", "lagging", "disconnected", "unknown"]


class MockNebulaReplicationAdapter:
    """Advances a canned replication posture on each summary read (deterministic)."""

    _sequence: tuple[NebulaStatus, ...] = (
        "healthy",
        "lagging",
        "healthy",
        "disconnected",
        "healthy",
    )

    def __init__(self) -> None:
        self._index = 0

    def reset(self) -> None:
        self._index = 0

    def replication_summary(self) -> dict[str, object]:
        status = self._sequence[self._index % len(self._sequence)]
        self._index += 1
        return {
            "status": status,
            "observed_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "partner_id": "mock-partner-1",
            "detail": None if status == "healthy" else f"mock nebula: {status}",
        }
