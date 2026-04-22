"""Validate machine-readable specs: JSON files and OpenAPI YAML."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

_ROOT = Path(__file__).resolve().parents[1]
_SPECS = _ROOT / "specs"


def _load_json(path: Path) -> None:
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SystemExit(f"invalid JSON {path}: {e}") from e


def _validate_openapi() -> None:
    path = _SPECS / "api" / "openapi.yaml"
    if not path.is_file():
        raise SystemExit("missing specs/api/openapi.yaml")
    try:
        doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        raise SystemExit(f"invalid YAML {path}: {e}") from e
    if not isinstance(doc, dict) or "openapi" not in doc:
        raise SystemExit(f"{path} must be an OpenAPI document")


def main() -> None:
    if not _SPECS.is_dir():
        print("missing specs/ directory", file=sys.stderr)
        sys.exit(1)
    for path in sorted(_SPECS.rglob("*.json")):
        _load_json(path)
    for path in sorted(_SPECS.rglob("*.yaml")):
        yaml.safe_load(path.read_text(encoding="utf-8"))
    _validate_openapi()


if __name__ == "__main__":
    main()
