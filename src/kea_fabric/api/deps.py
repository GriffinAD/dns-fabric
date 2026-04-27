"""FastAPI dependencies (auth + service access)."""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from typing import Annotated, Literal, TypeVar, cast

from fastapi import Depends, Header, HTTPException, Query, Request

from kea_fabric.services.fabric import FabricService
from kea_fabric.settings import ApiSettings
from kea_fabric.structured_logging import GlobalStructuredLogger, LogLevel

AuthRole = Literal["operator", "viewer"]
DEFAULT_PAGE_SIZE = 500
MAX_PAGE_SIZE = 500


@dataclass(frozen=True)
class PageParams:
    cursor: int = 0
    page_size: int = DEFAULT_PAGE_SIZE


TItem = TypeVar("TItem")


def get_settings(request: Request) -> ApiSettings:
    return cast(ApiSettings, request.app.state.settings)


def get_fabric_service(request: Request) -> FabricService:
    return cast(FabricService, request.app.state.fabric_service)


def get_global_logger(request: Request) -> GlobalStructuredLogger:
    return cast(GlobalStructuredLogger, request.app.state.global_logger)


def resolve_page_params(
    cursor: Annotated[int, Query(ge=0)] = 0,
    page_size: Annotated[int | None, Query(alias="page_size", ge=1, le=MAX_PAGE_SIZE)] = None,
    limit: Annotated[int | None, Query(ge=1, le=MAX_PAGE_SIZE)] = None,
) -> PageParams:
    """Resolve uniform paging args.

    `page_size` is canonical; `limit` remains a backwards-compatible alias.
    If omitted, default to DEFAULT_PAGE_SIZE and enforce MAX_PAGE_SIZE.
    """
    requested = page_size if page_size is not None else limit
    effective_page_size = requested if requested is not None else DEFAULT_PAGE_SIZE
    return PageParams(cursor=cursor, page_size=effective_page_size)


def paged_items_response(
    *,
    items: list[TItem],
    total_count: int,
    cursor: int,
    page_size: int,
    next_cursor: int | None,
) -> dict[str, object]:
    total_pages = ceil(total_count / page_size) if total_count > 0 else 0
    return {
        "items": items,
        "cursor": cursor,
        "page_size": page_size,
        "total_count": total_count,
        "total_pages": total_pages,
        "next_cursor": next_cursor,
    }


def _extract_bearer(authorization: str | None) -> str | None:
    if authorization is None or not authorization.startswith("Bearer "):
        return None
    return authorization[7:].strip() or None


def _emit_auth_log(
    request: Request,
    *,
    level: LogLevel,
    event: str,
    message: str,
    operation: str,
    subcategory: str = "auth",
) -> None:
    logger = getattr(request.app.state, "global_logger", None)
    if logger is None:
        return
    logger.emit(
        level=level,
        event=event,
        message=message,
        service="api",
        operation=operation,
        subcategory=subcategory,
    )


def resolve_auth_role(
    request: Request,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    access_token: Annotated[str | None, Query(alias="access_token")] = None,
) -> AuthRole:
    """Resolve operator vs viewer when auth is enabled (anonymous OK when disabled)."""
    settings: ApiSettings = request.app.state.settings
    bearer = _extract_bearer(authorization)
    query_token = access_token
    if query_token is not None and request.url.path != "/api/v1/events/stream":
        query_token = None
    token = bearer or query_token
    if not settings.auth_enabled:
        request.state.auth_role = "operator"
        _emit_auth_log(
            request,
            level="DEBUG",
            event="auth.bypass.disabled",
            message="auth disabled",
            operation="resolve_auth_role",
        )
        return "operator"
    if token is None:
        _emit_auth_log(
            request,
            level="WARN",
            event="auth.denied.missing_token",
            message="missing bearer or access_token",
            operation="resolve_auth_role",
        )
        raise HTTPException(
            status_code=401,
            detail={"title": "Unauthorized", "status": 401},
        )
    if settings.api_token is not None and token == settings.api_token:
        request.state.auth_role = "operator"
        _emit_auth_log(
            request,
            level="INFO",
            event="auth.granted.operator",
            message="operator token accepted",
            operation="resolve_auth_role",
        )
        return "operator"
    if settings.viewer_token is not None and token == settings.viewer_token:
        request.state.auth_role = "viewer"
        _emit_auth_log(
            request,
            level="INFO",
            event="auth.granted.viewer",
            message="viewer token accepted",
            operation="resolve_auth_role",
        )
        return "viewer"
    _emit_auth_log(
        request,
        level="WARN",
        event="auth.denied.invalid_token",
        message="token not recognized",
        operation="resolve_auth_role",
    )
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
