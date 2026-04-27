"""Validate committed OpenAPI and enforce runtime/schema parity."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

from export_openapi import export_openapi_dict

_ROOT = Path(__file__).resolve().parents[1]
_OPENAPI = _ROOT / "specs" / "api" / "openapi.yaml"


def main() -> None:
    if not _OPENAPI.is_file():
        print("missing specs/api/openapi.yaml", file=sys.stderr)
        sys.exit(1)
    committed = yaml.safe_load(_OPENAPI.read_text(encoding="utf-8"))
    if not isinstance(committed, dict):
        print("OpenAPI root must be a mapping", file=sys.stderr)
        sys.exit(1)
    ver = committed.get("openapi")
    if not isinstance(ver, str) or not ver.startswith("3."):
        print("openapi: field must be a 3.x semver string", file=sys.stderr)
        sys.exit(1)
    if "info" not in committed or "paths" not in committed:
        print("OpenAPI must include info and paths", file=sys.stderr)
        sys.exit(1)
    generated = export_openapi_dict()
    if committed != generated:
        print(
            "OpenAPI drift detected: specs/api/openapi.yaml is out of date.",
            file=sys.stderr,
        )
        print(
            "Run: uv run python scripts/export_openapi.py",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
