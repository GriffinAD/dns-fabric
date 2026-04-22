"""Validate committed OpenAPI; full export-vs-tree drift when export_openapi lands."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

_ROOT = Path(__file__).resolve().parents[1]
_OPENAPI = _ROOT / "specs" / "api" / "openapi.yaml"


def main() -> None:
    if not _OPENAPI.is_file():
        print("missing specs/api/openapi.yaml", file=sys.stderr)
        sys.exit(1)
    doc = yaml.safe_load(_OPENAPI.read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        print("OpenAPI root must be a mapping", file=sys.stderr)
        sys.exit(1)
    ver = doc.get("openapi")
    if not isinstance(ver, str) or not ver.startswith("3."):
        print("openapi: field must be a 3.x semver string", file=sys.stderr)
        sys.exit(1)
    if "info" not in doc or "paths" not in doc:
        print("OpenAPI must include info and paths", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
