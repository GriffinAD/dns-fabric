"""DHCP list and patch service backed by a DHCP data source."""

from __future__ import annotations

import copy
from typing import Any, cast

from fastapi import HTTPException

from kea_fabric.adapters.dhcp import DhcpDataSource
from kea_fabric.api.stub_data import LIST_PATHS
from kea_fabric.domain.dhcp import to_lease, to_pool, to_reservation


class DhcpDataService:
    def __init__(self, *, dhcp: DhcpDataSource) -> None:
        self._dhcp = dhcp

    def _apply_list_mock(
        self,
        path: str,
        payload: dict[str, Any],
        mock: str | None,
    ) -> dict[str, Any]:
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
        data = copy.deepcopy(payload)
        if mock == "empty" and path in LIST_PATHS:
            data["items"] = []
        return data

    def list_plugins(self, mock: str | None) -> dict[str, Any]:
        payload = self._apply_list_mock("/plugins", self._dhcp.plugins_payload(), mock)
        items = payload.get("items")
        if isinstance(items, list):
            next_items: list[dict[str, Any]] = []
            for row in items:
                if not isinstance(row, dict):
                    continue
                plugin_id = str(row.get("id", ""))
                capabilities = ["dashboard.read"]
                if plugin_id.startswith("dhcp."):
                    capabilities.append("dhcp.read")
                if plugin_id.startswith("discovery."):
                    capabilities.append("discovery.read")
                if plugin_id.startswith("perf."):
                    capabilities.append("perf.read")
                next_items.append(
                    {
                        **row,
                        "version": str(row.get("version", "1.0.0")),
                        "capabilities": row.get("capabilities", capabilities),
                    }
                )
            payload["items"] = next_items
        return payload

    def list_pools(self, mock: str | None) -> dict[str, Any]:
        payload = self._apply_list_mock("/dhcp/pools", self._dhcp.pools_payload(), mock)
        items = payload.get("items")
        if isinstance(items, list):
            payload["items"] = [to_pool(row) for row in items if isinstance(row, dict)]
        return payload

    def list_clients(self, mock: str | None) -> dict[str, Any]:
        payload = self._apply_list_mock(
            "/dhcp/clients",
            self._dhcp.clients_payload(),
            mock,
        )
        items = payload.get("items")
        if isinstance(items, list):
            payload["items"] = [to_lease(row) for row in items if isinstance(row, dict)]
        return payload

    def list_reservations(self, mock: str | None) -> dict[str, Any]:
        payload = self._apply_list_mock(
            "/dhcp/reservations",
            self._dhcp.reservations_payload(),
            mock,
        )
        items = payload.get("items")
        if isinstance(items, list):
            payload["items"] = [
                to_reservation(row) for row in items if isinstance(row, dict)
            ]
        return payload

    def patch_client(self, client_id: str, body: object) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise HTTPException(
                status_code=400,
                detail={"title": "Invalid JSON", "status": 400},
            )
        allowed = {"hostname", "vendor_name"}
        patch = {k: v for k, v in body.items() if k in allowed}
        if not patch:
            raise HTTPException(
                status_code=400,
                detail={"title": "No editable fields provided", "status": 400},
            )
        row = self._dhcp.update_client(client_id, patch)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail={"title": "client not found", "status": 404},
            )
        assert isinstance(row, dict)
        return cast(dict[str, Any], to_lease(row))

    def patch_reservation(self, reservation_id: str, body: object) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise HTTPException(
                status_code=400,
                detail={"title": "Invalid JSON", "status": 400},
            )
        allowed = {"hardware_address", "reserved_address", "hostname"}
        patch = {k: v for k, v in body.items() if k in allowed}
        if not patch:
            raise HTTPException(
                status_code=400,
                detail={"title": "No editable fields provided", "status": 400},
            )
        row = self._dhcp.update_reservation(reservation_id, patch)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail={"title": "reservation not found", "status": 404},
            )
        assert isinstance(row, dict)
        return cast(dict[str, Any], to_reservation(row))
