"""`/api/v1` routes — domain service + optional bearer auth (Phase B)."""

from __future__ import annotations

from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from kea_fabric.api.deps import (
    AuthRole,
    PageParams,
    get_fabric_service,
    get_global_logger,
    paged_items_response,
    require_operator,
    resolve_auth_role,
    resolve_page_params,
)
from kea_fabric.api.event_stream import fabric_sse_lines
from kea_fabric.services.fabric import FabricService
from kea_fabric.structured_logging import LOG_LEVELS, GlobalStructuredLogger, LogsQuery

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


@router.patch("/dhcp/clients/{client_id}")
async def patch_client(
    client_id: str,
    request: Request,
    __op: Annotated[AuthRole, Depends(require_operator)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    logger: Annotated[GlobalStructuredLogger, Depends(get_global_logger)],
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        logger.emit(
            level="WARN",
            event="api.route.invalid_json",
            message="invalid json body",
            service="api",
            operation="patch_client",
            subcategory="validation",
            error_type="invalid_json",
        )
        raise HTTPException(
            status_code=400,
            detail={"title": "Invalid JSON", "status": 400},
        ) from None
    return svc.patch_client(client_id, body)


@router.patch("/dhcp/reservations/{reservation_id}")
async def patch_reservation(
    reservation_id: str,
    request: Request,
    __op: Annotated[AuthRole, Depends(require_operator)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    logger: Annotated[GlobalStructuredLogger, Depends(get_global_logger)],
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        logger.emit(
            level="WARN",
            event="api.route.invalid_json",
            message="invalid json body",
            service="api",
            operation="patch_reservation",
            subcategory="validation",
            error_type="invalid_json",
        )
        raise HTTPException(
            status_code=400,
            detail={"title": "Invalid JSON", "status": 400},
        ) from None
    return svc.patch_reservation(reservation_id, body)


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
    logger: Annotated[GlobalStructuredLogger, Depends(get_global_logger)],
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        logger.emit(
            level="WARN",
            event="api.route.invalid_json",
            message="invalid json body",
            service="api",
            operation="post_discovery_pause",
            subcategory="validation",
            error_type="invalid_json",
        )
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


@router.get("/admin/logs")
def get_admin_logs(
    __op: Annotated[AuthRole, Depends(require_operator)],
    logger: Annotated[GlobalStructuredLogger, Depends(get_global_logger)],
    service: Annotated[str | None, Query()] = None,
    operation: Annotated[str | None, Query()] = None,
    subcategory: Annotated[str | None, Query()] = None,
    level: Annotated[str | None, Query()] = None,
    mode: Annotated[str | None, Query()] = None,
    from_ts: Annotated[str | None, Query(alias="from")] = None,
    to_ts: Annotated[str | None, Query(alias="to")] = None,
    paging: Annotated[PageParams, Depends(resolve_page_params)] = PageParams(),
) -> dict[str, Any]:
    if level is not None and level not in LOG_LEVELS:
        logger.emit(
            level="WARN",
            event="admin.logs.invalid_level",
            message="invalid log level filter",
            service="admin",
            operation="logs.query",
            subcategory="validation",
            error_type="invalid_level",
            error_message=level,
        )
        raise HTTPException(
            status_code=400,
            detail={
                "title": "Invalid log level",
                "status": 400,
                "detail": f"Allowed levels: {', '.join(LOG_LEVELS)}",
            },
        )
    q = LogsQuery(
        service=service,
        operation=operation,
        subcategory=subcategory,
        level=level,
        mode=mode,
        from_ts=from_ts,
        to_ts=to_ts,
        cursor=paging.cursor,
        limit=paging.page_size,
    )
    logger.emit(
        level="INFO",
        event="admin.logs.query",
        message="admin logs query",
        service="admin",
        operation="logs.query",
        subcategory="admin",
        mode=mode,
    )
    result = logger.query(q)
    return cast(
        dict[str, Any],
        paged_items_response(
            items=cast(list[dict[str, Any]], result.get("items", [])),
            total_count=int(result.get("total_count", 0)),
            cursor=paging.cursor,
            page_size=paging.page_size,
            next_cursor=cast(int | None, result.get("next_cursor")),
        ),
    )


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
    logger: Annotated[GlobalStructuredLogger, Depends(get_global_logger)],
) -> Response:
    try:
        body = await request.json()
    except Exception:
        logger.emit(
            level="WARN",
            event="api.route.invalid_json",
            message="invalid json body",
            service="api",
            operation="put_layout",
            subcategory="validation",
            error_type="invalid_json",
        )
        return JSONResponse({"title": "Invalid JSON", "status": 400}, status_code=400)
    svc.put_layout(dashboard_id, body)
    return Response(status_code=204)


@router.post("/dashboards/{dashboard_id}/layout/save-file")
async def save_dashboard_layout_file(
    dashboard_id: str,
    request: Request,
    __op: Annotated[AuthRole, Depends(require_operator)],
    svc: Annotated[FabricService, Depends(get_fabric_service)],
    logger: Annotated[GlobalStructuredLogger, Depends(get_global_logger)],
) -> dict[str, str]:
    """Persist layout to the live store and write a timestamped JSON snapshot."""
    try:
        body = await request.json()
    except Exception as exc:
        logger.emit(
            level="WARN",
            event="api.route.invalid_json",
            message="invalid json body",
            service="api",
            operation="save_dashboard_layout_file",
            subcategory="validation",
            error_type="invalid_json",
        )
        raise HTTPException(
            status_code=400,
            detail={"title": "Invalid JSON", "status": 400},
        ) from exc
    return svc.save_layout_to_file(dashboard_id, body)


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
