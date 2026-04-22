"""FastAPI dependencies (auth + service access)."""

from __future__ import annotations

from typing import Annotated, Literal, cast

from fastapi import Depends, Header, HTTPException, Query, Request

from kea_fabric.services.fabric import FabricService
from kea_fabric.settings import ApiSettings

AuthRole = Literal["operator", "viewer"]


def get_settings(request: Request) -> ApiSettings:
    return cast(ApiSettings, request.app.state.settings)


def get_fabric_service(request: Request) -> FabricService:
    return cast(FabricService, request.app.state.fabric_service)


def _extract_bearer(authorization: str | None) -> str | None:
    if authorization is None or not authorization.startswith("Bearer "):
        return None
    return authorization[7:].strip() or None


def resolve_auth_role(
    request: Request,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    access_token: Annotated[str | None, Query(alias="access_token")] = None,
) -> AuthRole:
    """Resolve operator vs viewer when auth is enabled (anonymous OK when disabled)."""
    settings: ApiSettings = request.app.state.settings
    bearer = _extract_bearer(authorization)
    token = bearer or access_token
    if not settings.auth_enabled:
        return "operator"
    if token is None:
        raise HTTPException(
            status_code=401,
            detail={"title": "Unauthorized", "status": 401},
        )
    if settings.api_token is not None and token == settings.api_token:
        return "operator"
    if settings.viewer_token is not None and token == settings.viewer_token:
        return "viewer"
    raise HTTPException(
        status_code=401,
        detail={"title": "Unauthorized", "status": 401},
    )


def require_operator(role: Annotated[AuthRole, Depends(resolve_auth_role)]) -> AuthRole:
    if role == "viewer":
        raise HTTPException(
            status_code=403,
            detail={"title": "Forbidden", "status": 403},
        )
    return role
