"""`/api/v1` routes — domain service + optional bearer auth (Phase B)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from kea_fabric.api.deps import (
    AuthRole,
    get_fabric_service,
    require_operator,
    resolve_auth_role,
)
from kea_fabric.api.event_stream import fabric_sse_lines
from kea_fabric.services.fabric import FabricService

router = APIRouter()


@router.get("/health")
def get_health(
    svc: Annotated[FabricService, Depends(get_fabric_service)],
) -> dict[str, Any]:
    return svc.get_health()


@router.get("/meta")
def get_meta(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    mock: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return svc.get_meta(mock)


@router.get("/plugins")
def get_plugins(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    mock: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return svc.list_plugins(mock)


@router.get("/dhcp/pools")
def get_pools(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    mock: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return svc.list_pools(mock)


@router.get("/dhcp/clients")
def get_clients(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    mock: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return svc.list_clients(mock)


@router.get("/dhcp/reservations")
def get_reservations(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    mock: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return svc.list_reservations(mock)


@router.get("/discovery/records")
def get_discovery_records(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    mock: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return svc.list_discovery_records(mock)


@router.get("/discovery/scan")
def get_discovery_scan(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
) -> dict[str, Any]:
    return svc.get_discovery_scan()


@router.post("/discovery/scan/pause")
async def post_discovery_pause(
    request: Request,
    __op: Annotated[AuthRole, Depends(require_operator)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"title": "Invalid JSON", "status": 400},
        ) from None
    return svc.post_discovery_pause(body)


@router.get("/perf/summary")
def get_perf(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    mock: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    return svc.get_perf(mock)


@router.get("/admin/replication/summary")
def get_replication_summary(
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
) -> dict[str, object]:
    return svc.nebula_replication_summary()


@router.get("/dashboards/{dashboard_id}/layout")
def get_layout(
    dashboard_id: str,
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
) -> dict[str, Any]:
    return svc.get_layout(dashboard_id)


@router.put("/dashboards/{dashboard_id}/layout")
async def put_layout(
    dashboard_id: str,
    request: Request,
    __op: Annotated[AuthRole, Depends(require_operator)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
) -> Response:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"title": "Invalid JSON", "status": 400}, status_code=400)
    svc.put_layout(dashboard_id, body)
    return Response(status_code=204)


@router.post("/dashboards/{dashboard_id}/layout/reset")
def reset_layout(
    dashboard_id: str,
    __op: Annotated[AuthRole, Depends(require_operator)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
) -> dict[str, Any]:
    """Restore layout from read-only ``dashboard-layouts.orig.json`` on disk."""
    return svc.reset_layout_from_orig(dashboard_id)


@router.get("/events/stream")
async def stream_events(
    request: Request,
    _: Annotated[AuthRole, Depends(resolve_auth_role)],
) -> StreamingResponse:
    return StreamingResponse(
        fabric_sse_lines(request),
        media_type="text/event-stream; charset=utf-8",
    )
