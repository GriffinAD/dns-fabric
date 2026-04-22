"""ASGI entrypoint for the operator HTTP API."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from kea_fabric.adapters import MockDhcpAdapter, MockNebulaReplicationAdapter
from kea_fabric.api import v1_router
from kea_fabric.persistence import JsonLayoutStore
from kea_fabric.services.fabric import FabricService
from kea_fabric.settings import ApiSettings

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
    yield


def create_app(settings: ApiSettings | None = None) -> FastAPI:
    settings = settings or ApiSettings.from_env()
    layout_store = JsonLayoutStore(settings.data_dir / "dashboard-layouts.json")
    fabric = FabricService(
        settings=settings,
        layout_store=layout_store,
        dhcp=MockDhcpAdapter(),
        nebula=MockNebulaReplicationAdapter(),
    )
    app = FastAPI(
        title="Kea Fabric API",
        version="1.0.0",
        lifespan=_lifespan,
    )
    app.state.settings = settings
    app.state.fabric_service = fabric
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
