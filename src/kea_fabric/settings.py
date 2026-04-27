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


def _resolved_data_dir() -> Path:
    """Resolve ``.fabric-data`` when ``KEA_FABRIC_DATA_DIR`` is unset (walk parents)."""
    raw = os.environ.get("KEA_FABRIC_DATA_DIR")
    if raw is not None and raw.strip() != "":
        return Path(raw).expanduser().resolve()
    start = Path.cwd().resolve()
    for base in [start, *list(start.parents)[:24]]:
        d = base / ".fabric-data"
        if not d.is_dir():
            continue
        has_live = (d / "dashboard-layouts.json").is_file()
        has_orig = (d / "dashboard-layouts.orig.json").is_file()
        if has_live or has_orig:
            return d.resolve()
    return (start / ".fabric-data").resolve()


@dataclass(frozen=True, slots=True)
class ApiSettings:
    """API process settings. Construct via `from_env` or pass explicitly in tests."""

    data_dir: Path
    api_token: str | None = None
    viewer_token: str | None = None
    sse_interval_seconds: float = 15.0
    dhcp_backend: str = "mock"
    kea_endpoint: str | None = None

    @property
    def auth_enabled(self) -> bool:
        return self.api_token is not None or self.viewer_token is not None

    @classmethod
    def from_env(cls) -> ApiSettings:
        sse_raw = os.environ.get("KEA_FABRIC_SSE_INTERVAL_SEC", "15")
        return cls(
            data_dir=_resolved_data_dir(),
            api_token=_env_str("KEA_FABRIC_API_TOKEN"),
            viewer_token=_env_str("KEA_FABRIC_API_VIEWER_TOKEN"),
            sse_interval_seconds=float(sse_raw),
            dhcp_backend=(
                os.environ.get("KEA_FABRIC_DHCP_BACKEND", "mock").strip() or "mock"
            ),
            kea_endpoint=_env_str("KEA_FABRIC_KEA_ENDPOINT"),
        )
