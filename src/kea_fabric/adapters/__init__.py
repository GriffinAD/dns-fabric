"""Adapters to Kea / Nebula (mock implementations for Phase B)."""

from kea_fabric.adapters.dhcp import MockDhcpAdapter
from kea_fabric.adapters.nebula import MockNebulaReplicationAdapter

__all__ = ["MockDhcpAdapter", "MockNebulaReplicationAdapter"]
