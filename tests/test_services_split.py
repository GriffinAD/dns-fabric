from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi import HTTPException

from kea_fabric.api import create_app as create_api_package_app
from kea_fabric.services.dhcp_service import DhcpDataService
from kea_fabric.services.discovery_service import DiscoveryService
from kea_fabric.settings import ApiSettings


class _FakeDhcp:
    def pools_payload(self) -> dict[str, Any]:
        return {"items": "bad-shape"}

    def clients_payload(self) -> dict[str, Any]:
        return {"items": "bad-shape"}

    def reservations_payload(self) -> dict[str, Any]:
        return {"items": "bad-shape"}

    def discovery_records_payload(self) -> dict[str, Any]:
        return {"items": "bad-shape"}

    def plugins_payload(self) -> dict[str, Any]:
        return {
            "items": [{"id": "dhcp.pools", "enabled": True, "name": "x"}, "not-a-dict"]
        }

    def perf_payload(self) -> dict[str, Any]:
        return {"cpu_percent_total": 1.0}

    def update_client(
        self, client_id: str, patch: dict[str, Any]
    ) -> dict[str, Any] | None:
        return {
            "id": client_id,
            "pool_id": "p1",
            "subnet_cidr": "192.168.1.0/24",
            "assigned_address": "192.168.1.11",
            "hardware_address": "aa:bb",
            "hostname": patch.get("hostname", "x"),
            "vendor_name": patch.get("vendor_name", "x"),
            "lease_started_at": "2026-01-01T00:00:00Z",
            "lease_expires_at": "2026-01-02T00:00:00Z",
            "client_category": "dynamic",
            "scan_status": "seen",
            "services": [],
        }

    def update_reservation(
        self, reservation_id: str, patch: dict[str, Any]
    ) -> dict[str, Any] | None:
        return {
            "id": reservation_id,
            "subnet_cidr": "192.168.1.0/24",
            "reserved_address": patch.get("reserved_address", "192.168.1.50"),
            "hardware_address": patch.get("hardware_address", "aa:bb"),
            "hostname": patch.get("hostname", "x"),
            "vendor_name": "x",
            "category": "static",
            "scan_status": "seen",
            "services": [],
        }


def test_dhcp_service_handles_non_list_items_and_plugin_injection() -> None:
    svc = DhcpDataService(dhcp=_FakeDhcp())
    plugins = svc.list_plugins(mock=None)
    assert len(plugins["items"]) == 1
    assert plugins["items"][0]["version"] == "1.0.0"
    assert "dhcp.read" in plugins["items"][0]["capabilities"]

    assert svc.list_pools(mock=None)["items"] == "bad-shape"
    assert svc.list_clients(mock=None)["items"] == "bad-shape"
    assert svc.list_reservations(mock=None)["items"] == "bad-shape"


def test_dhcp_service_plugins_non_list_is_passthrough() -> None:
    class _BadPlugins(_FakeDhcp):
        def plugins_payload(self) -> dict[str, Any]:
            return {"items": "bad-shape"}

    svc = DhcpDataService(dhcp=_BadPlugins())
    assert svc.list_plugins(mock=None)["items"] == "bad-shape"


def test_discovery_service_branches_and_errors() -> None:
    svc = DiscoveryService(dhcp=_FakeDhcp())
    assert svc.list_discovery_records(mock=None)["items"] == "bad-shape"
    assert svc.list_discovery_records(mock="empty")["items"] == []
    with pytest.raises(HTTPException):
        svc.list_discovery_records(mock="error")


def test_api_package_create_app_wrapper(tmp_path: Path) -> None:
    app = create_api_package_app(settings=ApiSettings(data_dir=tmp_path))
    assert app is not None
