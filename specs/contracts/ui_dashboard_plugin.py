"""UI dashboard plugin contract.

Mirrors ``specs/api/openapi.yaml`` ``PluginEntry`` and ``UiDashboardManifest``.
"""

from typing import Literal, NotRequired, Protocol, TypedDict, runtime_checkable

HostControl = Literal["single-panel", "tab-control", "vertical-stack", "split-grid"]


class UiDashboardManifest(TypedDict):
    """``components/schemas/UiDashboardManifest`` — required keys per OpenAPI."""

    allowed_host_controls: list[HostControl]
    default_size_hint: str
    supports_compact: bool
    supports_full: bool
    min_size: str | None
    max_size: str | None
    compact_min_footprint: str | None


class PluginEntry(TypedDict):
    """OpenAPI ``PluginEntry`` (optional ``ui_dashboard`` for non-UI plugins)."""

    id: str
    name: str
    enabled: bool
    ui_dashboard: NotRequired[UiDashboardManifest]


class PluginListResponse(TypedDict):
    items: list[PluginEntry]


@runtime_checkable
class UiDashboardPlugin(Protocol):
    """Process-side placeholder for a UI-capable plugin (id + optional manifest shape).

    The HTTP contract is ``PluginEntry``; this protocol is for Python callers
    that model installed plugins outside the OpenAPI client.
    """

    @property
    def plugin_id(self) -> str: ...

    @property
    def ui_dashboard(self) -> UiDashboardManifest | None: ...
