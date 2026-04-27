"""Perf summary service."""

from __future__ import annotations

import copy
from typing import Any

from fastapi import HTTPException

from kea_fabric.adapters.dhcp import DhcpDataSource


class PerfService:
    def __init__(self, *, dhcp: DhcpDataSource) -> None:
        self._dhcp = dhcp

    def get_perf(self, mock: str | None) -> dict[str, Any]:
        if mock == "error":
            raise HTTPException(status_code=503)
        return copy.deepcopy(self._dhcp.perf_payload())
