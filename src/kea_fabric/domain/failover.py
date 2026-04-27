"""Failover domain stubs for future Kea HA integrations."""

from __future__ import annotations

from typing import Literal, TypedDict

FailoverState = Literal["healthy", "degraded", "disconnected", "unknown"]


class FailoverGroup(TypedDict):
    id: str
    primary: str
    secondary: str
    state: FailoverState
