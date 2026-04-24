"""Static JSON bodies aligned with apps/ui/src/mock/fixtures.ts (OpenAPI-shaped)."""

from __future__ import annotations

from typing import Any

from kea_fabric.api.stub_mock_tables import MOCK_T0_ISO

STUB_HEALTH: dict[str, Any] = {
    "status": "ok",
    "checked_at": MOCK_T0_ISO,
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
            "id": "perf.cpu",
            "name": "CPU",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": ["single-panel", "vertical-stack"],
                "default_size_hint": "sm",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "120x80",
                "supports_compact": True,
                "supports_full": True,
            },
        },
        {
            "id": "perf.ram",
            "name": "Memory",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": ["single-panel", "vertical-stack"],
                "default_size_hint": "sm",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "100x100",
                "supports_compact": True,
                "supports_full": True,
            },
        },
        {
            "id": "perf.network",
            "name": "Network",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": ["single-panel", "vertical-stack"],
                "default_size_hint": "sm",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "120x80",
                "supports_compact": True,
                "supports_full": True,
            },
        },
        {
            "id": "perf.disk",
            "name": "Disk",
            "enabled": True,
            "ui_dashboard": {
                "allowed_host_controls": ["single-panel", "vertical-stack"],
                "default_size_hint": "sm",
                "min_size": None,
                "max_size": None,
                "compact_min_footprint": "120x80",
                "supports_compact": True,
                "supports_full": True,
            },
        },
        {
            "id": "perf.summary",
            "name": "Performance (legacy)",
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

LIST_PATHS = frozenset(
    {
        "/plugins",
        "/dhcp/pools",
        "/dhcp/clients",
        "/dhcp/reservations",
        "/discovery/records",
    },
)
