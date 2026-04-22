"""Static JSON bodies aligned with apps/ui/src/mock/fixtures.ts (OpenAPI-shaped)."""

from __future__ import annotations

from typing import Any

STUB_HEALTH: dict[str, Any] = {
    "status": "ok",
    "checked_at": "2026-04-22T10:00:00Z",
    "dependencies": [{"name": "api", "status": "ok", "detail": None}],
}

STUB_META: dict[str, Any] = {
    "api_version": "1.0.0",
    "service": "kea-fabric",
    "dashboard_embed_auth": "none",
}

STUB_PLUGINS: dict[str, Any] = {
    "items": [
        {
            "id": "dhcp.pools",
            "name": "DHCP pools",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": [
                    "single-panel",
                    "tab-control",
                    "vertical-stack",
                    "split-grid",
                ],
                "default_size_hint": "md",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "200x120",
                "supports_compact": True,
                "supports_full": True,
            },
        },
        {
            "id": "dhcp.clients",
            "name": "DHCP clients",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": [
                    "single-panel",
                    "tab-control",
                    "vertical-stack",
                    "split-grid",
                ],
                "default_size_hint": "lg",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "240x160",
                "supports_compact": True,
                "supports_full": True,
            },
        },
        {
            "id": "dhcp.reservations",
            "name": "Static reservations",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": ["single-panel", "vertical-stack"],
                "default_size_hint": "md",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "200x120",
                "supports_compact": True,
                "supports_full": True,
            },
        },
        {
            "id": "discovery.records",
            "name": "Discovery",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": ["single-panel", "tab-control"],
                "default_size_hint": "lg",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "280x140",
                "supports_compact": True,
                "supports_full": True,
            },
        },
        {
            "id": "perf.summary",
            "name": "Performance",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": ["single-panel", "vertical-stack"],
                "default_size_hint": "sm",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "160x100",
                "supports_compact": True,
                "supports_full": True,
            },
        },
    ],
}

STUB_POOLS: dict[str, Any] = {
    "items": [
        {
            "id": "pool-default",
            "subnet_cidr": "192.0.2.0/24",
            "range_start": "192.0.2.100",
            "range_end": "192.0.2.199",
            "dns_domain": "example.test",
        },
    ],
}

STUB_CLIENTS: dict[str, Any] = {
    "items": [
        {
            "id": "cli-1",
            "hardware_address": "52:54:00:ab:cd:ef",
            "assigned_address": "192.0.2.110",
            "pool_id": "pool-default",
            "hostname": "test-host",
            "client_category": "workstation",
            "vendor_name": "QEMU",
            "scan_status": "seen",
            "lease_started_at": "2026-04-22T08:00:00Z",
            "lease_expires_at": "2026-04-23T12:00:00Z",
            "subnet_cidr": "192.0.2.0/24",
            "services": ["ssh"],
        },
    ],
}

STUB_RESERVATIONS: dict[str, Any] = {
    "items": [
        {
            "id": "res-1",
            "hardware_address": "52:54:00:11:22:33",
            "reserved_address": "192.0.2.50",
            "hostname": "reserved",
            "category": "STATIC",
            "subnet_cidr": "192.0.2.0/24",
            "vendor_name": "LAB",
            "scan_status": "seen",
            "services": ["dhcp"],
        },
    ],
}

STUB_DISCOVERY_RECORDS: dict[str, Any] = {
    "items": [
        {
            "id": "disc-1",
            "last_seen_at": "2026-04-22T10:00:00Z",
            "state": "active",
            "addresses": ["192.0.2.88"],
            "labels": {"vendor": "lab"},
        },
    ],
}

STUB_PERF: dict[str, Any] = {
    "cpu_percent_total": 24.5,
    "cpu_core_percent": [22.0, 31.0, 18.0, 27.0],
    "memory_used_percent": 61.0,
    "memory_used_bytes": 8_000_000_000,
    "memory_total_bytes": 16_000_000_000,
    "network_in_mbps": 12.3,
    "network_out_mbps": 4.1,
    "network_adapters": [
        {"name": "eth0", "in_mbps": 10.0, "out_mbps": 3.5},
        {"name": "eth1", "in_mbps": 2.3, "out_mbps": 0.6},
    ],
    "disk_used_percent": 44.0,
    "disk_volumes": [
        {"label": "/", "used_percent": 44.0},
        {"label": "/var", "used_percent": 72.0},
    ],
    "collected_at": "2026-04-22T10:05:00Z",
}

LIST_PATHS = frozenset(
    {
        "/plugins",
        "/dhcp/pools",
        "/dhcp/clients",
        "/dhcp/reservations",
        "/discovery/records",
    },
)
