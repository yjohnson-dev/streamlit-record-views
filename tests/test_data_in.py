"""Building records and links from tables, and drawing the result."""

from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from record_views import (
    Color,
    Link,
    RecordStyle,
    RecordField,
    lineage_graph,
    records_from_frame,
)

CREATURES = pd.DataFrame(
    {
        "kind": ["Wolf", "Wolf", "Elk", "Hunter"],
        "number": [1.0, 2.0, 3.0, float("nan")],
        "name": ["Alpha", "Pup", "Stag", "John Doe"],
        "state": ["Alive", "Alive", "Hunted", None],
        "seen": [date(2026, 10, 1), None, date(2026, 10, 3), None],
        "weight": [40, float("nan"), 300, float("nan")],
    }
)
FOOD = pd.DataFrame(
    {
        "eater": [1.0, 2.0, 1.0, None],
        "eaten": [3.0, 1.0, 2.0, 3.0],
        "how": ["hunts", "is nursed by", None, "hunts"],
    }
)


def test_tables_become_a_drawn_graph(lineage):
    records = records_from_frame(
        CREATURES,
        title="name",
        type_column="kind",
        id="number",
        status="state",
        timestamp="seen",
        fields=["weight"],
        styles={"Wolf": RecordStyle(":material/pets:", Color.BLUE)},
        status_colors={"Alive": "green", "Hunted": "red"},
    )
    alpha, pup, stag, sam = records
    assert [r.id for r in records] == ["1", "2", "3", None]
    assert alpha.fields == (RecordField("weight", 40),)
    assert pup.fields == sam.fields == ()
    assert (alpha.icon, alpha.color, alpha.status_color) == (
        ":material/pets:",
        Color.BLUE,
        "green",
    )
    assert (stag.status_color, stag.timestamp) == ("red", date(2026, 10, 3))
    assert (sam.icon, sam.status) == (None, None)

    links = Link.from_frame(
        FOOD, record_1="eater", record_2="eaten", label="how"
    )
    assert links == [
        Link("1", "3", "hunts"),
        Link("2", "1", "is nursed by"),
        Link("1", "2"),
    ]

    lineage_graph([r for r in records if r.id], links)
    data = lineage.data
    assert {(e["from"], e["to"]) for e in data["edges"]} == {
        ("1", "3"),
        ("2", "1"),
        ("1", "2"),
    }


def test_a_bad_row_is_named(lineage):
    with pytest.raises(ValueError, match="Row 1: Record title is required"):
        records_from_frame(
            [{"name": "A"}, {"name": None}], title="name", record_type="T"
        )
    with pytest.raises(ValueError, match="No column 'nope'"):
        Link.from_frame(FOOD, record_1="nope", record_2="eaten")
    with pytest.raises(ValueError, match="Row 1: .*links to itself"):
        Link.from_frame(
            pd.DataFrame({"a": ["A", "B"], "b": ["B", "B"]}),
            record_1="a",
            record_2="b",
        )


def test_a_labeled_title_and_a_caption_map_from_columns():
    records = records_from_frame(
        CREATURES,
        title=("Wolf number", "name"),
        record_type="Creature",
        subtitle=("Seen", "state"),
        caption="kind",
    )
    alpha = records[0]
    assert alpha.title == RecordField("Wolf number", "Alpha")
    assert alpha.subtitle == RecordField("Seen", "Alive")
    assert alpha.caption == "Wolf"
    assert records[3].subtitle is None


def test_a_missing_labeled_title_names_the_row():
    frame = pd.DataFrame({"name": [None]})
    with pytest.raises(ValueError, match="Row 0: Record title is required"):
        records_from_frame(frame, title=("Number", "name"), record_type="X")
