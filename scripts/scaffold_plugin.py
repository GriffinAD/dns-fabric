"""Scaffold a minimal dashboard plugin manifest JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scaffold a Kea Fabric plugin manifest."
    )
    parser.add_argument("plugin_id", help="Plugin id, e.g. perf.timeseries")
    parser.add_argument("--name", default="New Plugin", help="Display name")
    parser.add_argument("--out", default="plugins", help="Output directory")
    args = parser.parse_args()

    out_dir = Path(args.out).resolve() / args.plugin_id
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "id": args.plugin_id,
        "name": args.name,
        "version": "1.0.0",
        "enabled": True,
        "capabilities": ["dashboard.read"],
        "ui_dashboard": {
            "allowed_host_controls": ["single-panel"],
            "default_size_hint": "md",
            "min_size": None,
            "max_size": None,
            "compact_min_footprint": "200x120",
            "supports_compact": True,
            "supports_full": True,
        },
    }
    path = out_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(path)


if __name__ == "__main__":
    main()
