"""Deterministic DHCP/discovery fixtures (see UI ``generateTableFixtures.ts``)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

MOCK_SUBNET_CIDR = "192.168.2.0/24"
MOCK_POOL_RANGE_START = "192.168.2.100"
MOCK_POOL_RANGE_END = "192.168.2.254"
MOCK_T0_ISO = "2026-04-22T12:00:00Z"
MOCK_DISCOVERY_RECORD_COUNT = 150

T0 = datetime(2026, 4, 22, 12, 0, 0, tzinfo=UTC)
POOL_ID = "pool-default"


def _iso_plus_seconds(sec: float) -> str:
    return (T0 + timedelta(seconds=sec)).isoformat().replace("+00:00", "Z")


class _Rng:
    __slots__ = ("_s",)

    def __init__(self, seed: int) -> None:
        self._s = seed & 0xFFFFFFFF

    def next_f(self) -> float:
        self._s = (self._s * 0x7F4A7C15 + 1) & 0xFFFFFFFF
        return self._s / 4294967296.0


def _mac_for_index(prefix: str, i: int) -> str:
    b3 = (i >> 16) & 0xFF
    b4 = (i >> 8) & 0xFF
    b5 = i & 0xFF
    return f"{prefix}:{b3:02x}:{b4:02x}:{b5:02x}"


def _shuffle_in_place(arr: list[Any], rng: _Rng) -> None:
    for i in range(len(arr) - 1, 0, -1):
        j = int(rng.next_f() * (i + 1))
        arr[i], arr[j] = arr[j], arr[i]


def _build_dhcp_client_items() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i in range(50):
        last_octet = 2 + i
        lease_start_sec = -3600 * (i + 1)
        lease_days = 1 + (i % 5)
        out.append(
            {
                "id": f"cli-static-{i + 1}",
                "hardware_address": _mac_for_index("52:54:00", 0x1000 + i),
                "assigned_address": f"192.168.2.{last_octet}",
                "pool_id": POOL_ID,
                "hostname": f"static-host-{i + 1}",
                "client_category": ("workstation", "server", "iot")[i % 3],
                "vendor_name": "LAB" if i % 2 == 0 else "QEMU",
                "scan_status": "seen",
                "lease_started_at": _iso_plus_seconds(lease_start_sec),
                "lease_expires_at": _iso_plus_seconds(
                    lease_start_sec + 86400 * lease_days,
                ),
                "subnet_cidr": MOCK_SUBNET_CIDR,
                "services": ["ssh", "dhcp"] if i % 4 == 0 else ["dhcp"],
            }
        )

    pool_hosts = list(range(100, 255))
    _shuffle_in_place(pool_hosts, _Rng(42_001))
    chosen = pool_hosts[:100]

    for j in range(100):
        last_octet = chosen[j]
        lease_start_sec = -1800 * (j + 1) - 50_000
        out.append(
            {
                "id": f"cli-dyn-{j + 1}",
                "hardware_address": _mac_for_index("52:54:01", 0x2000 + j),
                "assigned_address": f"192.168.2.{last_octet}",
                "pool_id": POOL_ID,
                "hostname": f"lease-{j + 1}",
                "client_category": "workstation",
                "vendor_name": "MockVendor",
                "scan_status": "seen",
                "lease_started_at": _iso_plus_seconds(lease_start_sec),
                "lease_expires_at": _iso_plus_seconds(
                    lease_start_sec + 86400 * (2 + (j % 4)),
                ),
                "subnet_cidr": MOCK_SUBNET_CIDR,
                "services": ["dhcp"],
            }
        )
    return out


_CLIENTS_CACHE: list[dict[str, Any]] | None = None


def dhcp_client_items() -> list[dict[str, Any]]:
    global _CLIENTS_CACHE
    if _CLIENTS_CACHE is None:
        _CLIENTS_CACHE = _build_dhcp_client_items()
    return _CLIENTS_CACHE


def dhcp_reservation_items() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i in range(28):
        last_octet = 52 + i
        out.append(
            {
                "id": f"res-{i + 1}",
                "hardware_address": _mac_for_index("52:54:02", 0x3000 + i),
                "reserved_address": f"192.168.2.{last_octet}",
                "hostname": f"reserved-{i + 1}",
                "category": "STATIC",
                "subnet_cidr": MOCK_SUBNET_CIDR,
                "vendor_name": "LAB",
                "scan_status": "seen",
                "services": ["dhcp"],
            }
        )
    return out


def discovery_record_items() -> list[dict[str, Any]]:
    clients = dhcp_client_items()
    out: list[dict[str, Any]] = []
    for i in range(MOCK_DISCOVERY_RECORD_COUNT):
        c = clients[i % len(clients)]
        addr = c["assigned_address"]
        last_seen_sec = -(i + 1) * 120
        state = "stale" if i % 17 == 0 else "lost" if i % 41 == 0 else "active"
        out.append(
            {
                "id": f"disc-{i + 1}",
                "last_seen_at": _iso_plus_seconds(last_seen_sec),
                "state": state,
                "addresses": [addr],
                "labels": {
                    "vendor": "lab" if i % 2 == 0 else "mock",
                    "role": f"row-{i + 1}",
                },
            }
        )
    return out


STUB_POOLS: dict[str, Any] = {
    "items": [
        {
            "id": POOL_ID,
            "subnet_cidr": MOCK_SUBNET_CIDR,
            "range_start": MOCK_POOL_RANGE_START,
            "range_end": MOCK_POOL_RANGE_END,
            "dns_domain": "example.test",
        },
    ],
}

STUB_CLIENTS: dict[str, Any] = {"items": dhcp_client_items()}
STUB_RESERVATIONS: dict[str, Any] = {"items": dhcp_reservation_items()}
STUB_DISCOVERY_RECORDS: dict[str, Any] = {"items": discovery_record_items()}
