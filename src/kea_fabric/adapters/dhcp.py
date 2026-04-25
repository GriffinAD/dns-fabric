"""Mock DHCP data shaped like Kea Fabric public DTOs (no live Kea)."""

from __future__ import annotations

import copy
from typing import Any, Protocol

from kea_fabric.api import state
from kea_fabric.api.perf_simulate import perf_summary_for_tick
from kea_fabric.api.stub_data import STUB_PLUGINS
from kea_fabric.api.stub_mock_tables import (
    STUB_CLIENTS,
    STUB_DISCOVERY_RECORDS,
    STUB_POOLS,
    STUB_RESERVATIONS,
)


class DhcpDataSource(Protocol):
    """Narrow port for list/read DHCP and related dashboard payloads."""

    def pools_payload(self) -> dict[str, Any]: ...

    def clients_payload(self) -> dict[str, Any]: ...

    def reservations_payload(self) -> dict[str, Any]: ...

    def discovery_records_payload(self) -> dict[str, Any]: ...

    def plugins_payload(self) -> dict[str, Any]: ...

    def perf_payload(self) -> dict[str, Any]: ...

    def update_client(
        self,
        client_id: str,
        patch: dict[str, Any],
    ) -> dict[str, Any] | None: ...

    def update_reservation(
        self,
        reservation_id: str,
        patch: dict[str, Any],
    ) -> dict[str, Any] | None: ...


class MockDhcpAdapter:
    """Deterministic fixtures; list ``mock=`` toggles run in the service layer."""

    def __init__(self) -> None:
        self._pools = copy.deepcopy(STUB_POOLS)
        self._clients = copy.deepcopy(STUB_CLIENTS)
        self._reservations = copy.deepcopy(STUB_RESERVATIONS)
        self._discovery_records = copy.deepcopy(STUB_DISCOVERY_RECORDS)

    def pools_payload(self) -> dict[str, Any]:
        return copy.deepcopy(self._pools)

    def clients_payload(self) -> dict[str, Any]:
        return copy.deepcopy(self._clients)

    def reservations_payload(self) -> dict[str, Any]:
        return copy.deepcopy(self._reservations)

    def discovery_records_payload(self) -> dict[str, Any]:
        return copy.deepcopy(self._discovery_records)

    def plugins_payload(self) -> dict[str, Any]:
        return copy.deepcopy(STUB_PLUGINS)

    def perf_payload(self) -> dict[str, Any]:
        return copy.deepcopy(perf_summary_for_tick(state.get_perf_tick()))

    def update_client(
        self,
        client_id: str,
        patch: dict[str, Any],
    ) -> dict[str, Any] | None:
        for idx, row in enumerate(self._clients["items"]):
            if row.get("id") == client_id:
                updated = {**row, **patch}
                self._clients["items"][idx] = updated
                return copy.deepcopy(updated)
        return None

    def update_reservation(
        self,
        reservation_id: str,
        patch: dict[str, Any],
    ) -> dict[str, Any] | None:
        for idx, row in enumerate(self._reservations["items"]):
            if row.get("id") == reservation_id:
                updated = {**row, **patch}
                self._reservations["items"][idx] = updated
                return copy.deepcopy(updated)
        return None
