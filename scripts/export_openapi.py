"""Export OpenAPI from the FastAPI runtime app."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

from kea_fabric.api.main import create_app

_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_OUTPUT = _ROOT / "specs" / "api" / "openapi.yaml"


def export_openapi_dict() -> dict[str, object]:
    """Build a detached OpenAPI document from the runtime app."""
    app = create_app()
    schema = app.openapi()
    # Keep comparisons deterministic across runs and Python versions.
    return json.loads(json.dumps(schema, sort_keys=True))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export runtime OpenAPI schema")
    parser.add_argument(
        "--output",
        type=Path,
        default=_DEFAULT_OUTPUT,
        help="Path to write OpenAPI YAML (default: specs/api/openapi.yaml)",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Write YAML to stdout instead of writing to disk",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    schema = export_openapi_dict()
    rendered = yaml.safe_dump(schema, sort_keys=True, allow_unicode=False)
    if args.stdout:
        print(rendered, end="")
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
