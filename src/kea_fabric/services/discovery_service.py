"""Discovery read/mutation operations for API routes."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from kea_fabric.adapters.dhcp import DhcpDataSource
from kea_fabric.api import state
from kea_fabric.api.stub_data import LIST_PATHS
from kea_fabric.domain.dhcp import to_discovery_record


class DiscoveryService:
    def __init__(self, *, dhcp: DhcpDataSource) -> None:
        self._dhcp = dhcp

    def list_discovery_records(self, mock: str | None) -> dict[str, Any]:
        if mock == "error":
            raise HTTPException(
                status_code=503,
                detail={
                    "type": "about:blank",
                    "title": "mock error",
                    "status": 503,
                    "detail": "mock=error",
                },
            )
        payload = self._dhcp.discovery_records_payload()
        if mock == "empty" and "/discovery/records" in LIST_PATHS:
            payload["items"] = []
        items = payload.get("items")
        if isinstance(items, list):
            payload["items"] = [
                to_discovery_record(row) for row in items if isinstance(row, dict)
            ]
        return payload

    def get_discovery_scan(self) -> dict[str, Any]:
        return state.get_discovery_scan()

    def post_discovery_pause(self, body: object) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise HTTPException(
                status_code=400,
                detail={"title": "Invalid JSON", "status": 400},
            )
        paused = bool(body["paused"]) if "paused" in body else True
        return state.set_discovery_paused(paused)
