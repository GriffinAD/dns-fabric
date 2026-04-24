"""Synthetic perf snapshots (aligned with ``apps/ui/src/mock/perfSimulate.ts``)."""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from typing import Any

T0_MS = datetime(2026, 4, 22, 12, 0, 0, tzinfo=UTC)
MOCK_SSE_INTERVAL_MS = 3000


def _collected_at_iso(tick: int) -> str:
    dt = T0_MS + timedelta(milliseconds=tick * MOCK_SSE_INTERVAL_MS)
    return dt.isoformat().replace("+00:00", "Z")


def _clamp(x: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, x))


def _det_noise(tick: int, salt: int) -> float:
    v = (tick ^ salt) & 0xFFFFFFFF
    x = (v * 0x9E3779B9) & 0xFFFFFFFF
    return (x % 1000) / 1000.0 - 0.5


def _hot_core_percent(tick: int, phase: float, noise_salt: int) -> float:
    return _clamp(
        82 + 15 * math.sin(tick * 0.13 + phase) + 2.5 * _det_noise(tick, noise_salt),
        70,
        100,
    )


def perf_summary_for_tick(tick: int) -> dict[str, Any]:
    cpu = _clamp(28 + 18 * math.sin(tick * 0.12) + 4 * _det_noise(tick, 1), 2, 98)
    cores = [
        _clamp(cpu + 5 * math.sin(tick * 0.09), 0, 100),
        _hot_core_percent(tick, 0.3, 41),
        _hot_core_percent(tick, 1.15, 43),
        _clamp(cpu + 5 * math.sin(tick * 0.09 + 2.7), 0, 100),
    ]
    mem_pct = _clamp(52 + 20 * math.sin(tick * 0.035) + 3 * _det_noise(tick, 2), 35, 88)
    memory_total_bytes = 16_000_000_000
    memory_used_bytes = int(round((mem_pct / 100.0) * memory_total_bytes))

    net_in = _clamp(6 + 5 * math.sin(tick * 0.08) + 2 * _det_noise(tick, 3), 0, 80)
    net_out = _clamp(2 + 3 * math.sin(tick * 0.11) + 1.5 * _det_noise(tick, 4), 0, 40)
    eth0_in = _clamp(net_in * 0.72 + 0.5 * _det_noise(tick, 5), 0, 80)
    eth0_out = _clamp(net_out * 0.65 + 0.4 * _det_noise(tick, 6), 0, 40)
    eth1_in = _clamp(net_in - eth0_in, 0, 80)
    eth1_out = _clamp(net_out - eth0_out, 0, 40)

    jump = 2.5 if tick % 43 == 0 else 0
    disk_root = _clamp(
        38 + (tick // 18) * 1.2 + jump + 2 * _det_noise(tick, 7),
        20,
        92,
    )
    disk_var = _clamp(disk_root + 18 + 6 * math.sin(tick * 0.02), 15, 96)

    return {
        "cpu_percent_total": cpu,
        "cpu_core_percent": cores,
        "memory_used_percent": mem_pct,
        "memory_used_bytes": memory_used_bytes,
        "memory_total_bytes": memory_total_bytes,
        "network_in_mbps": net_in,
        "network_out_mbps": net_out,
        "network_adapters": [
            {"name": "eth0", "in_mbps": eth0_in, "out_mbps": eth0_out},
            {"name": "eth1", "in_mbps": eth1_in, "out_mbps": eth1_out},
        ],
        "disk_used_percent": disk_root,
        "disk_volumes": [
            {"label": "/", "used_percent": disk_root},
            {"label": "/var", "used_percent": disk_var},
        ],
        "collected_at": _collected_at_iso(tick),
    }
