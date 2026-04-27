"""ASGI entrypoint for the operator HTTP API."""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.requests import Request
from fastapi.responses import Response

from kea_fabric.adapters.dhcp import KeaDhcpAdapter, MockDhcpAdapter
from kea_fabric.adapters.nebula import MockNebulaReplicationAdapter
from kea_fabric.api import v1_router
from kea_fabric.persistence import JsonLayoutStore
from kea_fabric.services.fabric import FabricService
from kea_fabric.settings import ApiSettings
from kea_fabric.structured_logging import GlobalStructuredLogger, LogLevel

_log = logging.getLogger("kea_fabric.api")


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: ApiSettings = app.state.settings
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    _log.info(
        "Kea Fabric API starting data_dir=%s auth_enabled=%s",
        settings.data_dir,
        settings.auth_enabled,
    )
    app.state.global_logger.emit(
        level="INFO",
        event="api.startup",
        message="Kea Fabric API starting",
        service="api",
        operation="startup",
        subcategory="lifecycle",
    )
    yield


def create_app(settings: ApiSettings | None = None) -> FastAPI:
    settings = settings or ApiSettings.from_env()
    global_logger = GlobalStructuredLogger(data_dir=settings.data_dir)
    layout_store = JsonLayoutStore(settings.data_dir / "dashboard-layouts.json")
    dhcp = (
        KeaDhcpAdapter(endpoint=settings.kea_endpoint)
        if settings.dhcp_backend == "kea"
        else MockDhcpAdapter()
    )
    fabric = FabricService(
        settings=settings,
        layout_store=layout_store,
        global_logger=global_logger,
        dhcp=dhcp,
        nebula=MockNebulaReplicationAdapter(),
    )
    app = FastAPI(
        title="Kea Fabric API",
        version="1.0.0",
        lifespan=_lifespan,
    )

    @app.middleware("http")
    async def request_logging_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as exc:
            global_logger.emit(
                level="ERROR",
                event="api.request.failed",
                message="request failed with exception",
                service="api",
                operation=f"{request.method} {request.url.path}",
                subcategory="request",
                request_id=request_id,
                actor=getattr(request.state, "auth_role", None),
                error_type=type(exc).__name__,
                error_message=str(exc),
            )
            raise
        duration_ms = int((time.perf_counter() - started) * 1000)
        level: LogLevel = "INFO" if status_code < 400 else "WARN"
        global_logger.emit(
            level=level,
            event="api.request.completed",
            message=f"{request.method} {request.url.path}",
            service="api",
            operation=f"{request.method} {request.url.path}",
            subcategory="request",
            request_id=request_id,
            actor=getattr(request.state, "auth_role", None),
            mode=settings.dhcp_backend,
        )
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Response-Time-Ms"] = str(duration_ms)
        return response

    app.state.settings = settings
    app.state.fabric_service = fabric
    app.state.global_logger = global_logger
    app.include_router(v1_router.router, prefix="/api/v1")
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run(
        "kea_fabric.api.main:app",
        host="127.0.0.1",
        port=8080,
        reload=False,
    )


__all__ = ["app", "create_app", "main"]
