"""DHCP domain shapes and DTO mapping helpers."""

from __future__ import annotations

from typing import Any, TypedDict


class Pool(TypedDict):
    id: str
    subnet_cidr: str
    range_start: str
    range_end: str
    dns_domain: str


class Lease(TypedDict):
    id: str
    pool_id: str
    subnet_cidr: str
    assigned_address: str
    hardware_address: str
    hostname: str
    vendor_name: str
    lease_started_at: str
    lease_expires_at: str
    client_category: str
    scan_status: str
    services: list[str]


class Reservation(TypedDict):
    id: str
    subnet_cidr: str
    reserved_address: str
    hardware_address: str
    hostname: str
    vendor_name: str
    category: str
    scan_status: str
    services: list[str]


class DiscoveryRecord(TypedDict):
    id: str
    state: str
    addresses: list[str]
    labels: list[str]
    last_seen_at: str


def _list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    return []


def to_pool(raw: dict[str, Any]) -> Pool:
    return {
        "id": str(raw.get("id", "")),
        "subnet_cidr": str(raw.get("subnet_cidr", "")),
        "range_start": str(raw.get("range_start", "")),
        "range_end": str(raw.get("range_end", "")),
        "dns_domain": str(raw.get("dns_domain", "")),
    }


def to_lease(raw: dict[str, Any]) -> Lease:
    return {
        "id": str(raw.get("id", "")),
        "pool_id": str(raw.get("pool_id", "")),
        "subnet_cidr": str(raw.get("subnet_cidr", "")),
        "assigned_address": str(raw.get("assigned_address", "")),
        "hardware_address": str(raw.get("hardware_address", "")),
        "hostname": str(raw.get("hostname", "")),
        "vendor_name": str(raw.get("vendor_name", "")),
        "lease_started_at": str(raw.get("lease_started_at", "")),
        "lease_expires_at": str(raw.get("lease_expires_at", "")),
        "client_category": str(raw.get("client_category", "")),
        "scan_status": str(raw.get("scan_status", "")),
        "services": _list(raw.get("services")),
    }


def to_reservation(raw: dict[str, Any]) -> Reservation:
    return {
        "id": str(raw.get("id", "")),
        "subnet_cidr": str(raw.get("subnet_cidr", "")),
        "reserved_address": str(raw.get("reserved_address", "")),
        "hardware_address": str(raw.get("hardware_address", "")),
        "hostname": str(raw.get("hostname", "")),
        "vendor_name": str(raw.get("vendor_name", "")),
        "category": str(raw.get("category", "")),
        "scan_status": str(raw.get("scan_status", "")),
        "services": _list(raw.get("services")),
    }


def to_discovery_record(raw: dict[str, Any]) -> DiscoveryRecord:
    return {
        "id": str(raw.get("id", "")),
        "state": str(raw.get("state", "")),
        "addresses": _list(raw.get("addresses")),
        "labels": _list(raw.get("labels")),
        "last_seen_at": str(raw.get("last_seen_at", "")),
    }
