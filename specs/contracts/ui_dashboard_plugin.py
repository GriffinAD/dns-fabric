"""UI dashboard plugin protocol stub (see docs/architecture/dashboard-plugin-blueprint.md)."""

from typing import Protocol, runtime_checkable


@runtime_checkable
class UiDashboardPlugin(Protocol):
    """Placeholder protocol; expand when the plugin host is implemented."""

    @property
    def plugin_id(self) -> str: ...
