"""HTTP API (Phase B): FastAPI app matching specs/api/openapi.yaml."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI


def create_app(*args: Any, **kwargs: Any) -> FastAPI:
    from kea_fabric.api.main import create_app as _create_app

    return _create_app(*args, **kwargs)

__all__ = ["create_app"]
