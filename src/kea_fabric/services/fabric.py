"""Legacy façade that composes focused API services."""

from __future__ import annotations

import copy
from typing import Any

from fastapi import HTTPException

from kea_fabric.adapters.dhcp import DhcpDataSource, MockDhcpAdapter
from kea_fabric.adapters.nebula import MockNebulaReplicationAdapter
from kea_fabric.api.stub_data import STUB_HEALTH, STUB_META
from kea_fabric.persistence.layout_store import JsonLayoutStore
from kea_fabric.services.audit_service import AuditLogService
from kea_fabric.services.dhcp_service import DhcpDataService
from kea_fabric.services.discovery_service import DiscoveryService
from kea_fabric.services.layout_service import DashboardLayoutService
from kea_fabric.services.perf_service import PerfService
from kea_fabric.services.replication_service import ReplicationService
from kea_fabric.settings import ApiSettings


class FabricService:
    def __init__(
        self,
        *,
        settings: ApiSettings,
        layout_store: JsonLayoutStore,
        dhcp: DhcpDataSource | None = None,
        nebula: MockNebulaReplicationAdapter | None = None,
    ) -> None:
        self._dhcp = dhcp or MockDhcpAdapter()
        self._replication_adapter = nebula or MockNebulaReplicationAdapter()
        self._audit = AuditLogService(data_dir=settings.data_dir)
        self._layout = DashboardLayoutService(
            settings=settings,
            layout_store=layout_store,
        )
        self._dhcp_service = DhcpDataService(dhcp=self._dhcp)
        self._discovery = DiscoveryService(dhcp=self._dhcp)
        self._perf = PerfService(dhcp=self._dhcp)
        self._replication = ReplicationService(nebula=self._replication_adapter)

    @property
    def nebula_adapter(self) -> MockNebulaReplicationAdapter:
        return self._replication_adapter

    def reset_mocks_for_tests(self) -> None:
        """Reset volatile mock adapter state (pytest)."""
        self._replication.reset_for_tests()

    def get_health(self) -> dict[str, Any]:
        return copy.deepcopy(STUB_HEALTH)

    def get_meta(self, mock: str | None) -> dict[str, Any]:
        if mock == "error":
            raise HTTPException(
                status_code=503,
                detail={"type": "about:blank", "title": "mock error", "status": 503},
            )
        return copy.deepcopy(STUB_META)

    def list_plugins(self, mock: str | None) -> dict[str, Any]:
        return self._dhcp_service.list_plugins(mock)

    def list_pools(self, mock: str | None) -> dict[str, Any]:
        return self._dhcp_service.list_pools(mock)

    def list_clients(self, mock: str | None) -> dict[str, Any]:
        return self._dhcp_service.list_clients(mock)

    def list_reservations(self, mock: str | None) -> dict[str, Any]:
        return self._dhcp_service.list_reservations(mock)

    def list_discovery_records(self, mock: str | None) -> dict[str, Any]:
        return self._discovery.list_discovery_records(mock)

    def get_discovery_scan(self) -> dict[str, Any]:
        return self._discovery.get_discovery_scan()

    def post_discovery_pause(self, body: object) -> dict[str, Any]:
        result = self._discovery.post_discovery_pause(body)
        paused = result.get("state") == "paused"
        self._audit.record(
            "discovery.pause",
            {"state": result.get("state"), "paused": bool(paused)},
        )
        return result

    def patch_client(self, client_id: str, body: object) -> dict[str, Any]:
        row = self._dhcp_service.patch_client(client_id, body)
        self._audit.record("dhcp.client.patch", {"id": client_id})
        return row

    def patch_reservation(self, reservation_id: str, body: object) -> dict[str, Any]:
        row = self._dhcp_service.patch_reservation(reservation_id, body)
        self._audit.record("dhcp.reservation.patch", {"id": reservation_id})
        return row

    def get_perf(self, mock: str | None) -> dict[str, Any]:
        return self._perf.get_perf(mock)

    def get_layout(self, dashboard_id: str) -> dict[str, Any]:
        return self._layout.get_layout(dashboard_id)

    def put_layout(self, dashboard_id: str, body: object) -> None:
        self._layout.put_layout(dashboard_id, body)
        self._audit.record("dashboard.layout.put", {"dashboard_id": dashboard_id})

    def save_layout_to_file(self, dashboard_id: str, body: object) -> dict[str, str]:
        result = self._layout.save_layout_to_file(dashboard_id, body)
        self._audit.record(
            "dashboard.layout.save_file",
            {"dashboard_id": dashboard_id, "filename": result.get("filename")},
        )
        return result

    def reset_layout_from_orig(self, dashboard_id: str) -> dict[str, Any]:
        result = self._layout.reset_layout_from_orig(dashboard_id)
        self._audit.record("dashboard.layout.reset", {"dashboard_id": dashboard_id})
        return result

    def nebula_replication_summary(self) -> dict[str, object]:
        return self._replication.summary()
