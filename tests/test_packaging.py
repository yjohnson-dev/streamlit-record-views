from __future__ import annotations

import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _manifest(path: Path) -> dict:
    with path.open("rb") as handle:
        return tomllib.load(handle)


def test_component_declarations_match():
    outer = _manifest(ROOT / "pyproject.toml")
    inner = _manifest(ROOT / "record_views" / "pyproject.toml")
    assert outer["project"]["name"] == inner["project"]["name"]
    assert outer["project"]["version"] == inner["project"]["version"]
    outer_components = outer["tool"]["streamlit"]["component"]["components"]
    inner_components = inner["tool"]["streamlit"]["component"]["components"]
    assert [c["name"] for c in outer_components] == [
        c["name"] for c in inner_components
    ]
    assert {c["asset_dir"] for c in outer_components} == {
        "record_views/frontend/build"
    }
    assert {c["asset_dir"] for c in inner_components} == {"frontend/build"}
