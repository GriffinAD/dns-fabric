"""Replication status service backed by Nebula adapter."""

from __future__ import annotations

from kea_fabric.adapters.nebula import MockNebulaReplicationAdapter
from kea_fabric.domain.failover import FailoverGroup


class ReplicationService:
    def __init__(self, *, nebula: MockNebulaReplicationAdapter) -> None:
        self._nebula = nebula

    def summary(self) -> dict[str, object]:
        summary = self._nebula.replication_summary()
        failover_groups: list[FailoverGroup] = [
            {
                "id": "mock-failover-group-1",
                "primary": "kea-a",
                "secondary": "kea-b",
                "state": "unknown",
            }
        ]
        return {**summary, "failover_groups": failover_groups}

    def reset_for_tests(self) -> None:
        self._nebula.reset()
