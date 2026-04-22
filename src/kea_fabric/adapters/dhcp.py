"""Mock DHCP data shaped like Kea Fabric public DTOs (no live Kea)."""

from __future__ import annotations

import copy
from typing import Any, Protocol

from kea_fabric.api.stub_data import (
    STUB_CLIENTS,
    STUB_DISCOVERY_RECORDS,
    STUB_PERF,
    STUB_PLUGINS,
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
        return copy.deepcopy(STUB_PERF)
