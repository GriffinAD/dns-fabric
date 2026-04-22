"""Tests for Phase B FastAPI (`/api/v1`) — services, persistence, auth, SSE."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from kea_fabric.api import state
from kea_fabric.api.event_stream import fabric_sse_lines
from kea_fabric.api.main import create_app
from kea_fabric.settings import ApiSettings


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    state.reset_stub_state()
    settings = ApiSettings(
        data_dir=tmp_path,
        api_token=None,
        viewer_token=None,
        sse_interval_seconds=0.05,
    )
    app = create_app(settings=settings)
    with TestClient(app) as c:
        yield c
    state.reset_stub_state()


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_health_no_auth_required(client: TestClient) -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_meta(client: TestClient) -> None:
    r = client.get("/api/v1/meta")
    assert r.status_code == 200
    assert r.json()["service"] == "kea-fabric"


def test_meta_mock_error(client: TestClient) -> None:
    r = client.get("/api/v1/meta", params={"mock": "error"})
    assert r.status_code == 503


def test_plugins(client: TestClient) -> None:
    r = client.get("/api/v1/plugins")
    assert r.status_code == 200
    assert len(r.json()["items"]) >= 1


def test_plugins_mock_empty(client: TestClient) -> None:
    r = client.get("/api/v1/plugins", params={"mock": "empty"})
    assert r.status_code == 200
    assert r.json()["items"] == []


def test_plugins_mock_error(client: TestClient) -> None:
    r = client.get("/api/v1/plugins", params={"mock": "error"})
    assert r.status_code == 503


def test_dhcp_pools_empty_query(client: TestClient) -> None:
    r = client.get("/api/v1/dhcp/pools", params={"mock": "empty"})
    assert r.status_code == 200
    assert r.json()["items"] == []


def test_discovery_scan_and_pause(client: TestClient) -> None:
    r = client.get("/api/v1/discovery/scan")
    assert r.status_code == 200
    assert r.json()["state"] == "running"
    r2 = client.post("/api/v1/discovery/scan/pause", json={"paused": True})
    assert r2.status_code == 200
    assert r2.json()["state"] == "paused"
    r3 = client.post("/api/v1/discovery/scan/pause", json={"paused": False})
    assert r3.status_code == 200
    assert r3.json()["state"] == "running"


def test_discovery_pause_body_not_object(client: TestClient) -> None:
    r = client.post("/api/v1/discovery/scan/pause", json=[])
    assert r.status_code == 400


def test_discovery_pause_invalid_json(client: TestClient) -> None:
    r = client.post(
        "/api/v1/discovery/scan/pause",
        content=b"not-json",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 400


def test_layout_get_404_put_get(client: TestClient) -> None:
    r = client.get("/api/v1/dashboards/default/layout")
    assert r.status_code == 404
    body = {
        "version": 1,
        "tiles": [
            {
                "id": "t1",
                "pluginId": "dhcp.pools",
                "hostControl": "single-panel",
                "displayMode": "full",
            },
        ],
    }
    r2 = client.put("/api/v1/dashboards/default/layout", json=body)
    assert r2.status_code == 204
    r3 = client.get("/api/v1/dashboards/default/layout")
    assert r3.status_code == 200
    assert r3.json()["version"] == 1


def test_layout_persists_new_client_same_data_dir(tmp_path: Path) -> None:
    state.reset_stub_state()
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.05)
    body = {
        "version": 1,
        "tiles": [
            {
                "id": "t1",
                "pluginId": "dhcp.pools",
                "hostControl": "single-panel",
                "displayMode": "full",
            },
        ],
    }
    with TestClient(create_app(settings=settings)) as c1:
        assert c1.put("/api/v1/dashboards/my/layout", json=body).status_code == 204
    with TestClient(create_app(settings=settings)) as c2:
        r = c2.get("/api/v1/dashboards/my/layout")
        assert r.status_code == 200
        assert r.json()["tiles"][0]["id"] == "t1"
    state.reset_stub_state()


def test_layout_put_invalid(client: TestClient) -> None:
    r = client.put(
        "/api/v1/dashboards/default/layout",
        json={
            "version": 1,
            "tiles": [
                {
                    "id": "t1",
                    "pluginId": "p",
                    "hostControl": "not-a-control",
                    "displayMode": "full",
                },
            ],
        },
    )
    assert r.status_code == 400


def test_layout_put_bad_json(client: TestClient) -> None:
    r = client.put(
        "/api/v1/dashboards/default/layout",
        content=b"{",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 400


def test_perf_summary(client: TestClient) -> None:
    r = client.get("/api/v1/perf/summary")
    assert r.status_code == 200
    assert "cpu_percent_total" in r.json()


def test_replication_summary(client: TestClient) -> None:
    r = client.get("/api/v1/admin/replication/summary")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ("healthy", "lagging", "disconnected", "unknown")
    assert "observed_at" in data


def test_fabric_sse_lines_include_heartbeat_and_data(tmp_path: Path) -> None:
    async def collect() -> list[str]:
        settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.01)
        request = MagicMock(spec=Request)
        request.app.state.settings = settings
        buf: list[str] = []
        async for line in fabric_sse_lines(request):
            buf.append(line)
            if len(buf) >= 4:
                break
        return buf

    lines = asyncio.run(collect())
    joined = "".join(lines)
    assert "sse-heartbeat" in joined
    assert "fabric.perf.updated" in joined
    assert "data:" in joined


def test_layout_validate_false() -> None:
    from kea_fabric.api.layout_validate import is_dashboard_layout

    assert is_dashboard_layout({"version": 1, "tiles": []}) is True
    assert is_dashboard_layout({"version": 1, "tiles": [{}]}) is False
    assert is_dashboard_layout({"version": 1, "tiles": []}) is True
    assert is_dashboard_layout({"version": 0, "tiles": []}) is False
    assert is_dashboard_layout(None) is False


def test_list_endpoints_mock_empty(client: TestClient) -> None:
    for path in (
        "/api/v1/dhcp/clients",
        "/api/v1/dhcp/reservations",
        "/api/v1/discovery/records",
    ):
        r = client.get(path, params={"mock": "empty"})
        assert r.status_code == 200
        assert r.json()["items"] == []


def test_perf_mock_error(client: TestClient) -> None:
    r = client.get("/api/v1/perf/summary", params={"mock": "error"})
    assert r.status_code == 503


def test_layout_validate_grid_bounds() -> None:
    from kea_fabric.api.layout_validate import is_dashboard_layout

    def layout_with_grid(grid: object) -> object:
        return {
            "version": 1,
            "tiles": [
                {
                    "id": "a",
                    "pluginId": "p",
                    "hostControl": "single-panel",
                    "displayMode": "full",
                    "grid": grid,
                },
            ],
        }

    assert is_dashboard_layout(
        layout_with_grid({"col": 0, "row": 0, "colSpan": 12, "rowSpan": 1}),
    )
    assert is_dashboard_layout(
        layout_with_grid({"col": 6, "row": 0, "colSpan": 6, "rowSpan": 2}),
    )
    assert not is_dashboard_layout(
        layout_with_grid({"col": 6, "row": 0, "colSpan": 7, "rowSpan": 1}),
    )
    assert not is_dashboard_layout(
        layout_with_grid({"col": 0, "row": 0, "colSpan": 12}),
    )
    assert not is_dashboard_layout(
        layout_with_grid({"col": 0, "row": -1, "colSpan": 1, "rowSpan": 1}),
    )
    assert not is_dashboard_layout(
        layout_with_grid({"col": 0, "row": 0, "colSpan": 1, "rowSpan": 0}),
    )
    assert not is_dashboard_layout(
        layout_with_grid({"col": 0, "row": 0, "colSpan": 1, "rowSpan": 13}),
    )
    assert is_dashboard_layout(
        layout_with_grid({"col": 0, "row": 500, "colSpan": 1, "rowSpan": 1}),
    )
    assert not is_dashboard_layout(
        layout_with_grid({"col": "0", "row": 0, "colSpan": 1, "rowSpan": 1}),
    )
    assert not is_dashboard_layout(layout_with_grid("nope"))


def test_layout_validate_host_and_plugin() -> None:
    from kea_fabric.api.layout_validate import is_dashboard_layout

    assert (
        is_dashboard_layout(
            {
                "version": 1,
                "tiles": [
                    {
                        "id": "a",
                        "pluginId": "",
                        "hostControl": "single-panel",
                        "displayMode": "full",
                    },
                ],
            }
        )
        is False
    )
    assert (
        is_dashboard_layout(
            {
                "version": 1,
                "tiles": [
                    {
                        "id": "",
                        "pluginId": "p",
                        "hostControl": "single-panel",
                        "displayMode": "full",
                    },
                ],
            }
        )
        is False
    )
    bad_tiles: object = {"version": 1, "tiles": [None]}
    assert is_dashboard_layout(bad_tiles) is False
    bad_ver: object = {"version": "1", "tiles": []}
    assert is_dashboard_layout(bad_ver) is False
    bad_tiles_type: object = {"version": 1, "tiles": "nope"}
    assert is_dashboard_layout(bad_tiles_type) is False
    assert (
        is_dashboard_layout(
            {
                "version": 1,
                "tiles": [
                    {
                        "id": "a",
                        "pluginId": "p",
                        "hostControl": "single-panel",
                        "displayMode": "huge",
                    },
                ],
            }
        )
        is False
    )


def test_main_calls_uvicorn(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[tuple[tuple[object, ...], dict[str, object]]] = []

    def fake_run(*args: object, **kwargs: object) -> None:
        seen.append((args, kwargs))

    monkeypatch.setattr("uvicorn.run", fake_run)
    from kea_fabric.api import main as main_mod

    main_mod.main()
    assert len(seen) == 1


def test_auth_required_when_token_set(tmp_path: Path) -> None:
    state.reset_stub_state()
    settings = ApiSettings(
        data_dir=tmp_path,
        api_token="operator-secret",
        viewer_token=None,
        sse_interval_seconds=0.05,
    )
    with TestClient(create_app(settings=settings)) as c:
        assert c.get("/api/v1/meta").status_code == 401
        r = c.get("/api/v1/meta", headers=_auth_headers("operator-secret"))
        assert r.status_code == 200
    state.reset_stub_state()


def test_viewer_can_read_not_write(tmp_path: Path) -> None:
    state.reset_stub_state()
    settings = ApiSettings(
        data_dir=tmp_path,
        api_token="op",
        viewer_token="vi",
        sse_interval_seconds=0.05,
    )
    layout = {
        "version": 1,
        "tiles": [
            {
                "id": "t1",
                "pluginId": "dhcp.pools",
                "hostControl": "single-panel",
                "displayMode": "full",
            },
        ],
    }
    with TestClient(create_app(settings=settings)) as c:
        assert c.get("/api/v1/meta", headers=_auth_headers("vi")).status_code == 200
        r_vi = c.put(
            "/api/v1/dashboards/default/layout",
            json=layout,
            headers=_auth_headers("vi"),
        )
        assert r_vi.status_code == 403
        r_op = c.put(
            "/api/v1/dashboards/default/layout",
            json=layout,
            headers=_auth_headers("op"),
        )
        assert r_op.status_code == 204
    state.reset_stub_state()


def test_layout_reset_from_orig_copies_to_live(tmp_path: Path) -> None:
    state.reset_stub_state()
    baseline = {
        "default": {
            "version": 1,
            "tiles": [
                {
                    "id": "from-orig",
                    "pluginId": "dhcp.pools",
                    "hostControl": "single-panel",
                    "displayMode": "full",
                },
            ],
        },
    }

    orig_path = tmp_path / "dashboard-layouts.orig.json"
    orig_path.write_text(json.dumps(baseline, indent=2), encoding="utf-8")
    orig_snapshot = orig_path.read_bytes()
    live_path = tmp_path / "dashboard-layouts.json"
    live_path.write_text(
        json.dumps(
            {
                "default": {
                    "version": 1,
                    "tiles": [
                        {
                            "id": "old-live",
                            "pluginId": "dhcp.clients",
                            "hostControl": "single-panel",
                            "displayMode": "full",
                        },
                    ],
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.05)
    with TestClient(create_app(settings=settings)) as c:
        r = c.post("/api/v1/dashboards/default/layout/reset")
        assert r.status_code == 200
        assert r.json()["tiles"][0]["id"] == "from-orig"
        r2 = c.get("/api/v1/dashboards/default/layout")
        assert r2.status_code == 200
        assert r2.json()["tiles"][0]["id"] == "from-orig"
    assert orig_path.read_bytes() == orig_snapshot
    state.reset_stub_state()


def test_layout_reset_from_orig_missing_file(client: TestClient) -> None:
    r = client.post("/api/v1/dashboards/default/layout/reset")
    assert r.status_code == 404


def test_layout_reset_from_orig_invalid_json(tmp_path: Path) -> None:
    state.reset_stub_state()
    (tmp_path / "dashboard-layouts.orig.json").write_text(
        "{not-json",
        encoding="utf-8",
    )
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.05)
    with TestClient(create_app(settings=settings)) as c:
        r = c.post("/api/v1/dashboards/default/layout/reset")
        assert r.status_code == 500
        assert r.json()["detail"]["title"] == "baseline layout file is not valid JSON"
    state.reset_stub_state()


def test_layout_reset_from_orig_json_not_object(tmp_path: Path) -> None:
    state.reset_stub_state()
    (tmp_path / "dashboard-layouts.orig.json").write_text(
        json.dumps(["not", "an", "object"]),
        encoding="utf-8",
    )
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.05)
    with TestClient(create_app(settings=settings)) as c:
        r = c.post("/api/v1/dashboards/default/layout/reset")
        assert r.status_code == 500
        assert r.json()["detail"]["title"] == (
            "baseline layout file must be a JSON object"
        )
    state.reset_stub_state()


def test_layout_reset_from_orig_missing_or_invalid_dashboard(tmp_path: Path) -> None:
    state.reset_stub_state()
    (tmp_path / "dashboard-layouts.orig.json").write_text(
        json.dumps(
            {
                "other": {
                    "version": 1,
                    "tiles": [
                        {
                            "id": "t1",
                            "pluginId": "dhcp.pools",
                            "hostControl": "single-panel",
                            "displayMode": "full",
                        },
                    ],
                },
                "default": {"version": 1, "tiles": [{}]},
            },
        ),
        encoding="utf-8",
    )
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.05)
    with TestClient(create_app(settings=settings)) as c:
        r = c.post("/api/v1/dashboards/default/layout/reset")
        assert r.status_code == 400
        assert r.json()["detail"]["title"] == (
            "Invalid or missing layout in baseline file"
        )
    state.reset_stub_state()


def test_layout_reset_forbidden_for_viewer(tmp_path: Path) -> None:
    state.reset_stub_state()

    orig_path = tmp_path / "dashboard-layouts.orig.json"
    orig_path.write_text(
        json.dumps(
            {
                "default": {
                    "version": 1,
                    "tiles": [
                        {
                            "id": "t1",
                            "pluginId": "dhcp.pools",
                            "hostControl": "single-panel",
                            "displayMode": "full",
                        },
                    ],
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    settings = ApiSettings(
        data_dir=tmp_path,
        api_token="op",
        viewer_token="vi",
        sse_interval_seconds=0.05,
    )
    with TestClient(create_app(settings=settings)) as c:
        r = c.post(
            "/api/v1/dashboards/default/layout/reset",
            headers=_auth_headers("vi"),
        )
        assert r.status_code == 403
        r2 = c.post(
            "/api/v1/dashboards/default/layout/reset",
            headers=_auth_headers("op"),
        )
        assert r2.status_code == 200
    state.reset_stub_state()


def test_access_token_query_param_auth(tmp_path: Path) -> None:
    state.reset_stub_state()
    settings = ApiSettings(
        data_dir=tmp_path,
        api_token="tok",
        viewer_token=None,
        sse_interval_seconds=0.05,
    )
    with TestClient(create_app(settings=settings)) as c:
        assert c.get("/api/v1/meta").status_code == 401
        r = c.get("/api/v1/meta?access_token=tok")
        assert r.status_code == 200
    state.reset_stub_state()


def test_json_layout_store_roundtrip(tmp_path: Path) -> None:
    from kea_fabric.persistence.layout_store import JsonLayoutStore

    p = tmp_path / "layouts.json"
    store = JsonLayoutStore(p)
    assert store.get("x") is None
    store.set("x", {"version": 1, "tiles": []})
    assert store.get("x") == {"version": 1, "tiles": []}
    store.clear_dashboard("x")
    assert store.get("x") is None


def test_mock_nebula_cycles() -> None:
    from kea_fabric.adapters.nebula import MockNebulaReplicationAdapter

    n = MockNebulaReplicationAdapter()
    statuses = [n.replication_summary()["status"] for _ in range(6)]
    assert "healthy" in statuses
    n.reset()
    assert n.replication_summary()["status"] == "healthy"


def test_wrong_bearer_token_returns_401(tmp_path: Path) -> None:
    state.reset_stub_state()
    settings = ApiSettings(
        data_dir=tmp_path,
        api_token="good",
        viewer_token=None,
        sse_interval_seconds=0.05,
    )
    with TestClient(create_app(settings=settings)) as c:
        assert c.get("/api/v1/meta", headers=_auth_headers("bad")).status_code == 401
    state.reset_stub_state()


def test_get_settings_and_fabric_service_helpers(tmp_path: Path) -> None:
    from kea_fabric.api.deps import get_fabric_service, get_settings
    from kea_fabric.persistence.layout_store import JsonLayoutStore
    from kea_fabric.services.fabric import FabricService

    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.05)
    app = create_app(settings=settings)
    req = MagicMock()
    req.app.state.settings = app.state.settings
    req.app.state.fabric_service = app.state.fabric_service
    assert get_settings(req) is app.state.settings
    assert isinstance(get_fabric_service(req), FabricService)

    z_store = JsonLayoutStore(tmp_path / "z.json")
    fs = FabricService(settings=settings, layout_store=z_store)
    _ = fs.nebula_adapter
    fs.reset_mocks_for_tests()


def test_layout_store_malformed_file(tmp_path: Path) -> None:
    from kea_fabric.persistence.layout_store import JsonLayoutStore

    p = tmp_path / "bad.json"
    p.write_text("[]", encoding="utf-8")
    store = JsonLayoutStore(p)
    assert store.get("x") is None

    p2 = tmp_path / "bad2.json"
    p2.write_text(json.dumps({"x": "not-dict"}), encoding="utf-8")
    store2 = JsonLayoutStore(p2)
    assert store2.get("x") is None


def test_layout_store_clear_one_of_two(tmp_path: Path) -> None:
    from kea_fabric.persistence.layout_store import JsonLayoutStore

    store = JsonLayoutStore(tmp_path / "m.json")
    store.set("a", {"version": 1, "tiles": []})
    store.set("b", {"version": 1, "tiles": []})
    store.clear_dashboard("a")
    assert store.get("a") is None
    assert store.get("b") == {"version": 1, "tiles": []}


def test_layout_store_clear_all(tmp_path: Path) -> None:
    from kea_fabric.persistence.layout_store import JsonLayoutStore

    store = JsonLayoutStore(tmp_path / "n.json")
    store.set("a", {"version": 1, "tiles": []})
    store.clear_all()
    assert not (tmp_path / "n.json").is_file()


def test_events_stream_http_finishes_when_env_set(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("KEA_FABRIC_SSE_CLOSE_AFTER_DATA_EVENTS", "1")
    state.reset_stub_state()
    settings = ApiSettings(data_dir=tmp_path, sse_interval_seconds=0.01)
    with TestClient(create_app(settings=settings)) as c:
        r = c.get("/api/v1/events/stream")
        assert r.status_code == 200
        assert b"fabric.perf.updated" in r.content
    state.reset_stub_state()


def test_sse_close_after_env_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    from kea_fabric.api import event_stream as event_stream_mod

    monkeypatch.setenv("KEA_FABRIC_SSE_CLOSE_AFTER_DATA_EVENTS", "not-int")
    assert event_stream_mod._sse_close_after_data_events() == 0


def test_settings_from_env_ignores_empty_token(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("KEA_FABRIC_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KEA_FABRIC_API_TOKEN", "")
    monkeypatch.setenv("KEA_FABRIC_API_VIEWER_TOKEN", "   ")
    s = ApiSettings.from_env()
    assert s.api_token is None
    assert s.viewer_token is None


def test_settings_from_env_reads_non_empty_token(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("KEA_FABRIC_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KEA_FABRIC_API_TOKEN", "secret")
    s = ApiSettings.from_env()
    assert s.api_token == "secret"


def test_settings_from_env_discovers_repo_fabric_data_from_nested_cwd(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Starting the API from a subdirectory still finds ``repo/.fabric-data``."""
    monkeypatch.delenv("KEA_FABRIC_DATA_DIR", raising=False)
    repo = tmp_path / "repo"
    data = repo / ".fabric-data"
    data.mkdir(parents=True)
    (data / "dashboard-layouts.orig.json").write_text(
        '{"default":{"version":1,"tiles":[]}}',
        encoding="utf-8",
    )
    nested = repo / "apps" / "ui"
    nested.mkdir(parents=True)
    monkeypatch.chdir(nested)
    s = ApiSettings.from_env()
    assert s.data_dir == data.resolve()


def test_settings_from_env_discovers_via_live_layout_only(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """``.fabric-data`` is chosen when only ``dashboard-layouts.json`` exists."""
    monkeypatch.delenv("KEA_FABRIC_DATA_DIR", raising=False)
    repo = tmp_path / "repo"
    data = repo / ".fabric-data"
    data.mkdir(parents=True)
    (data / "dashboard-layouts.json").write_text(
        '{"default":{"version":1,"tiles":[]}}',
        encoding="utf-8",
    )
    nested = repo / "deep" / "nested"
    nested.mkdir(parents=True)
    monkeypatch.chdir(nested)
    s = ApiSettings.from_env()
    assert s.data_dir == data.resolve()


def test_settings_resolved_data_dir_fallback_when_no_layout_files(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Empty ``.fabric-data`` dirs are skipped; cwd ``.fabric-data`` is the fallback."""
    monkeypatch.delenv("KEA_FABRIC_DATA_DIR", raising=False)
    work = tmp_path / "proj" / "src"
    work.mkdir(parents=True)
    (work / ".fabric-data").mkdir()
    monkeypatch.chdir(work)
    s = ApiSettings.from_env()
    assert s.data_dir == (work / ".fabric-data").resolve()


def test_layout_store_clear_dashboard_missing_file(tmp_path: Path) -> None:
    from kea_fabric.persistence.layout_store import JsonLayoutStore

    JsonLayoutStore(tmp_path / "missing.json").clear_dashboard("nope")
