"""Orchestrates mock adapters, layout persistence, and list mock toggles."""

from __future__ import annotations

import copy
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from kea_fabric.adapters.dhcp import DhcpDataSource, MockDhcpAdapter
from kea_fabric.adapters.nebula import MockNebulaReplicationAdapter
from kea_fabric.api import layout_validate, state
from kea_fabric.api.stub_data import LIST_PATHS, STUB_HEALTH, STUB_META
from kea_fabric.persistence.layout_store import JsonLayoutStore
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
        self._settings = settings
        self._layout_store = layout_store
        self._dhcp = dhcp or MockDhcpAdapter()
        self._nebula = nebula or MockNebulaReplicationAdapter()

    @property
    def nebula_adapter(self) -> MockNebulaReplicationAdapter:
        return self._nebula

    def reset_mocks_for_tests(self) -> None:
        """Reset volatile mock adapter state (pytest)."""
        self._nebula.reset()

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
        return self._apply_list_mock("/plugins", self._dhcp.plugins_payload(), mock)

    def list_pools(self, mock: str | None) -> dict[str, Any]:
        return self._apply_list_mock("/dhcp/pools", self._dhcp.pools_payload(), mock)

    def list_clients(self, mock: str | None) -> dict[str, Any]:
        return self._apply_list_mock(
            "/dhcp/clients",
            self._dhcp.clients_payload(),
            mock,
        )

    def list_reservations(self, mock: str | None) -> dict[str, Any]:
        return self._apply_list_mock(
            "/dhcp/reservations",
            self._dhcp.reservations_payload(),
            mock,
        )

    def list_discovery_records(self, mock: str | None) -> dict[str, Any]:
        return self._apply_list_mock(
            "/discovery/records",
            self._dhcp.discovery_records_payload(),
            mock,
        )

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
        return row

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
        return row

    def get_perf(self, mock: str | None) -> dict[str, Any]:
        if mock == "error":
            raise HTTPException(status_code=503)
        return copy.deepcopy(self._dhcp.perf_payload())

    def get_layout(self, dashboard_id: str) -> dict[str, Any]:
        layout = self._layout_store.get(dashboard_id)
        if layout is None:
            raise HTTPException(
                status_code=404,
                detail={"title": "layout not found", "status": 404},
            )
        return layout

    def put_layout(self, dashboard_id: str, body: object) -> None:
        if not layout_validate.is_dashboard_layout(body):
            raise HTTPException(
                status_code=400,
                detail={"title": "Invalid layout", "status": 400},
            )
        assert isinstance(body, dict)
        self._layout_store.set(dashboard_id, body)

    def save_layout_to_file(self, dashboard_id: str, body: object) -> dict[str, str]:
        """Persist layout; write ``Dashboard_Layout_<ts>.json`` under ``data_dir``."""
        if not layout_validate.is_dashboard_layout(body):
            raise HTTPException(
                status_code=400,
                detail={"title": "Invalid layout", "status": 400},
            )
        assert isinstance(body, dict)
        self._layout_store.set(dashboard_id, body)
        exports_dir = self._settings.data_dir / "dashboard-layout-exports"
        exports_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        path = self._allocate_dashboard_export_path(exports_dir, ts)
        path.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
        return {"filename": path.name}

    @staticmethod
    def _allocate_dashboard_export_path(exports_dir: Path, ts: str) -> Path:
        base = exports_dir / f"Dashboard_Layout_{ts}.json"
        if not base.exists():
            return base
        for n in range(1, 1000):
            candidate = exports_dir / f"Dashboard_Layout_{ts}_{n}.json"
            if not candidate.exists():
                return candidate
        msg = "Could not allocate a unique dashboard export filename"
        raise HTTPException(status_code=500, detail={"title": msg, "status": 500})

    def reset_layout_from_orig(self, dashboard_id: str) -> dict[str, Any]:
        """Replace the live layout from read-only ``dashboard-layouts.orig.json``."""
        orig_path = self._settings.data_dir / "dashboard-layouts.orig.json"
        if not orig_path.is_file():
            hint = (
                f"Expected {orig_path}. "
                "Set KEA_FABRIC_DATA_DIR to the directory that contains "
                "dashboard-layouts.orig.json (next to dashboard-layouts.json)."
            )
            raise HTTPException(
                status_code=404,
                detail={
                    "title": "baseline layout file not found",
                    "status": 404,
                    "detail": hint,
                },
            )
        try:
            raw = json.loads(orig_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail={
                    "title": "baseline layout file is not valid JSON",
                    "status": 500,
                },
            )
        if not isinstance(raw, dict):
            raise HTTPException(
                status_code=500,
                detail={
                    "title": "baseline layout file must be a JSON object",
                    "status": 500,
                },
            )
        layout = raw.get(dashboard_id)
        layout_ok = isinstance(layout, dict) and layout_validate.is_dashboard_layout(
            layout,
        )
        if not layout_ok:
            raise HTTPException(
                status_code=400,
                detail={
                    "title": "Invalid or missing layout in baseline file",
                    "status": 400,
                },
            )
        assert isinstance(layout, dict)
        self._layout_store.set(dashboard_id, layout)
        return copy.deepcopy(layout)

    def nebula_replication_summary(self) -> dict[str, object]:
        return self._nebula.replication_summary()
