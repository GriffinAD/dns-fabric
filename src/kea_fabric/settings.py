"""Runtime configuration for the operator API (env-backed)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env_str(name: str) -> str | None:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return None
    return raw


@dataclass(frozen=True, slots=True)
class ApiSettings:
    """API process settings. Construct via `from_env` or pass explicitly in tests."""

    data_dir: Path
    api_token: str | None = None
    viewer_token: str | None = None
    sse_interval_seconds: float = 15.0

    @property
    def auth_enabled(self) -> bool:
        return self.api_token is not None or self.viewer_token is not None

    @classmethod
    def from_env(cls) -> ApiSettings:
        raw_dir = os.environ.get("KEA_FABRIC_DATA_DIR", ".fabric-data")
        sse_raw = os.environ.get("KEA_FABRIC_SSE_INTERVAL_SEC", "15")
        return cls(
            data_dir=Path(raw_dir).expanduser().resolve(),
            api_token=_env_str("KEA_FABRIC_API_TOKEN"),
            viewer_token=_env_str("KEA_FABRIC_API_VIEWER_TOKEN"),
            sse_interval_seconds=float(sse_raw),
        )
