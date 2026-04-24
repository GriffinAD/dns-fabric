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


class MockDhcpAdapter:
    """Deterministic fixtures; list ``mock=`` toggles run in the service layer."""

    def pools_payload(self) -> dict[str, Any]:
        return copy.deepcopy(STUB_POOLS)

    def clients_payload(self) -> dict[str, Any]:
        return copy.deepcopy(STUB_CLIENTS)

    def reservations_payload(self) -> dict[str, Any]:
        return copy.deepcopy(STUB_RESERVATIONS)

    def discovery_records_payload(self) -> dict[str, Any]:
        return copy.deepcopy(STUB_DISCOVERY_RECORDS)

    def plugins_payload(self) -> dict[str, Any]:
        return copy.deepcopy(STUB_PLUGINS)

    def perf_payload(self) -> dict[str, Any]:
        return copy.deepcopy(perf_summary_for_tick(state.get_perf_tick()))
