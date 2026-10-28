from __future__ import annotations

import math

import pandas as pd
import pytest

from record_views import EntityRef, Record, RecordField
from record_views.utils import clean_value, is_missing


@pytest.mark.parametrize("value", [None, math.nan, pd.NaT, pd.NA])
def test_missing_markers(value):
    assert is_missing(value)
    assert clean_value(value) is None


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("  text  ", "text"),
        ("None", "None"),
        ("", ""),
        (42, "42"),
        (1.5, "1.5"),
    ],
)
def test_clean_value_keeps_real_values(value, expected):
    assert clean_value(value) == expected


def test_fields_accept_dict_records_and_pairs():
    record = Record("Order", "A", fields={"Total": 5, "Note": None})
    assert record.fields == (RecordField("Total", 5), RecordField("Note", None))
    record = Record("Order", "A", fields=[RecordField("X", "1"), ("Y", 2)])
    assert [field.value for field in record.fields] == ["1", 2]


def test_text_attributes_are_cleaned():
    record = Record(
        "Order",
        " A ",
        id=42,
        subtitle=math.nan,
        caption=pd.NA,
        status=pd.NA,
        note="  Rush  ",
        timestamp=pd.NaT,
    )
    assert record.title == "A"
    assert record.id == "42"
    assert record.subtitle is None
    assert record.caption is None
    assert record.status is None
    assert record.note == "Rush"
    assert record.timestamp is None


def test_entities_accept_strings_and_tuples():
    record = Record(
        "Order",
        "A",
        id="SO-1",
        sources=["Acme"],
        targets=[("Warehouse North", "Location")],
    )
    assert record.sources == (EntityRef("Acme"),)
    assert record.targets == (EntityRef("Warehouse North", "Location"),)


def test_the_text_slots_keep_text_and_labeled_fields_as_given():
    record = Record(
        "Order",
        RecordField("Order", " 1234567 "),
        subtitle=("Customer", "Acme Corp"),
        caption="  Billed  ",
    )
    assert record.title == RecordField("Order", "1234567")
    assert record.subtitle == RecordField("Customer", "Acme Corp")
    assert record.caption == "Billed"
    assert Record("Order", " A ").title == "A"


@pytest.mark.parametrize("empty", [None, "", "  ", math.nan, pd.NA])
def test_an_empty_text_slot_is_none_and_an_empty_title_is_an_error(empty):
    record = Record("Order", "A", subtitle=empty, caption=("Label", empty))
    assert (record.subtitle, record.caption) == (None, None)
    with pytest.raises(ValueError, match="title is required"):
        Record("Order", empty)
    with pytest.raises(ValueError, match="title is required"):
        Record("Order", ("Order", empty))


def test_a_number_is_a_valid_value_for_a_labeled_slot():
    record = Record("Order", ("Order", 1234567), caption=("Items", 0))
    assert record.title.value == 1234567
    assert record.caption.value == 0
