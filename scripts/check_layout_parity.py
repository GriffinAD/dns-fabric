"""Check dashboard layout parity fixtures against the Python validator."""

from __future__ import annotations

import json
from pathlib import Path

from kea_fabric.api.layout_validate import is_dashboard_layout

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = ROOT / "specs" / "dashboard" / "parity"


def main() -> None:
    if not FIXTURE_DIR.is_dir():
        raise SystemExit(f"missing fixture directory: {FIXTURE_DIR}")
    failures: list[str] = []
    for path in sorted(FIXTURE_DIR.glob("layout.*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        expected = ".valid." in path.name
        actual = is_dashboard_layout(payload)
        if actual != expected:
            expected_state = "valid" if expected else "invalid"
            actual_state = "valid" if actual else "invalid"
            failures.append(
                f"{path.relative_to(ROOT)} expected {expected_state} "
                f"but validator returned {actual_state}"
            )
    if failures:
        raise SystemExit("\n".join(failures))


if __name__ == "__main__":
    main()
