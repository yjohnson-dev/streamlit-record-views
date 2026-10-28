from __future__ import annotations

from decimal import Decimal

import pytest

from record_views import Record, RecordField
from record_views.cards.payload import (
    LEDGER_FIELDS,
    PROPERTY_FIELDS,
    build_card_payload,
    color_name,
    drawn_fields,
    slot_payload,
)

RECORD = Record("Order", "A", fields={f"F{i}": i for i in range(6)})


@pytest.mark.parametrize(
    ("size", "limits", "max_fields", "count"),
    [
        ("small", None, None, 0),
        ("medium", None, None, 2),
        ("large", None, None, 6),
        ("large", None, 3, 3),
        ("medium", None, 5, 5),
        ("medium", None, 0, 0),
        ("small", None, 5, 0),
        ("compact", PROPERTY_FIELDS, 5, 1),
        ("medium", PROPERTY_FIELDS, None, 4),
        ("medium", LEDGER_FIELDS, None, 3),
    ],
)
def test_drawn_fields(size, limits, max_fields, count):
    args = (RECORD, size) if limits is None else (RECORD, size, limits)
    assert len(drawn_fields(*args, max_fields=max_fields)) == count


def test_slot_payload():
    assert slot_payload(None) is None
    assert slot_payload("Alpha") == [None, "Alpha"]
    assert slot_payload(RecordField("Order Date", "2026-09-23")) == [
        "Order Date",
        "2026-09-23",
    ]
    assert slot_payload(RecordField("", Decimal("1.5"))) == [None, 1.5]


def test_payload_contract():
    record = Record(
        "Order", "A", color="#00A1E0", status="Open", fields={"X": None}
    )
    payload = build_card_payload(record, "medium", status_badge=True)
    assert payload["color"] == "#00A1E0"
    assert payload["statusBadge"] is True
    assert payload["fields"] == [["X", None]]
    assert payload["absent"] == "None"
    assert set(payload) == {
        "size",
        "disabled",
        "recordType",
        "title",
        "subtitle",
        "color",
        "icon",
        "status",
        "statusColor",
        "statusBadge",
        "caption",
        "note",
        "fields",
        "absent",
    }


def test_payload_sends_numbers_as_json_numbers():
    record = Record(
        "Invoice", "A", fields={"Total": Decimal("12.50"), "Qty": 3}
    )
    assert build_card_payload(record, "large")["fields"] == [
        ["Total", 12.5],
        ["Qty", 3],
    ]


@pytest.mark.parametrize(
    "value",
    ["rgb(0 128 255 / 50%)", "hsl(210deg, 50%, 40%)", "oklch(0.7 0.1 250)"],
)
def test_color_name_accepts_css_colors(value):
    assert color_name(value) == value


@pytest.mark.parametrize(
    "value",
    [
        "rgb(0,0,0) ; --x: url(https://example.com/t.png)",
        "rgb(0) } body{display:none} rgb(1)",
    ],
)
def test_color_name_rejects_css_injection(value):
    with pytest.raises(ValueError):
        color_name(value)
