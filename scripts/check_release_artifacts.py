"""Ensure uv build produced non-empty wheel and sdist for the pinned version."""

from __future__ import annotations

import sys
import tomllib
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    with (_ROOT / "pyproject.toml").open("rb") as f:
        ver = tomllib.load(f)["project"]["version"]
    if not isinstance(ver, str):
        print("pyproject [project].version must be a string", file=sys.stderr)
        sys.exit(1)
    dist = _ROOT / "dist"
    whl = dist / f"kea_fabric-{ver}-py3-none-any.whl"
    # setuptools / uv sdist basename matches the import package (underscore).
    sdist = dist / f"kea_fabric-{ver}.tar.gz"
    missing: list[str] = []
    if not whl.is_file() or whl.stat().st_size == 0:
        missing.append(str(whl))
    if not sdist.is_file() or sdist.stat().st_size == 0:
        missing.append(str(sdist))
    if missing:
        print("missing or empty artifacts:\n  " + "\n  ".join(missing), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
