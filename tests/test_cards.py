"""card(), driven through its public function."""

from __future__ import annotations

from datetime import datetime

import pytest

from record_views import CardView, Record, RecordField, card, card_config

PLANT = Record(
    "Plant",
    "Basil",
    id="P-1",
    subtitle="Window box",
    caption=RecordField("Planted", "2026-10-01"),
    status="Growing",
    timestamp=datetime(2026, 10, 1, 9, 30),
    note="Needs water",
    fields={"Height": "12 cm", "Light": "Full sun", "Soil": "Loam", "pH": 6.5},
)


def test_each_variant_sends_its_variant_and_default_key(cards):
    card(CardView(PLANT))
    card(CardView(PLANT, "tile"))
    card(CardView(PLANT, card_config.PropertyCard()))
    card(
        CardView(
            PLANT, card_config.LedgerCard(headline="Height"), on_hover="large"
        )
    )
    assert set(cards.names) == {"card"}
    assert [c["data"]["variant"] for c in cards.calls] == [
        "record",
        "tile",
        "property",
        "ledger",
    ]
    assert cards.data["hover"]["variant"] == "ledger"
    assert [c["key"] for c in cards.calls] == [
        "card-record:P-1",
        "card-tile:P-1",
        "card-property:P-1",
        "card-ledger:P-1",
    ]
    assert cards.data["headline"] == ["Height", "12 cm"]
    assert "Height" not in [name for name, _ in cards.data["fields"]]


def test_config_decides_what_the_card_shows(cards):
    config = card_config.RecordCard(
        hide=["subtitle", "caption"],
        status_display="dot",
        max_fields=3,
        border=False,
        background=True,
    )
    card(CardView(PLANT, config, size="large"))
    data = cards.data
    assert (data["subtitle"], data["caption"]) == (None, None)
    assert data["note"] == "Needs water"
    assert (data["statusDisplay"], data["status"]) == ("dot", "Growing")
    assert len(data["fields"]) == 3
    assert (data["border"], data["background"]) == (False, True)

    card(
        CardView(
            PLANT,
            status_display_off := card_config.RecordCard(status_display=None),
        )
    )
    assert (cards.data["statusDisplay"], cards.data["status"]) == (None, None)
    assert status_display_off.border is True


def test_size_decides_how_many_fields_fit(cards):
    for size in ("compact", "small", "medium", "large"):
        card(CardView(PLANT, size=size), key=size)
    counts = {c["key"]: len(c["data"]["fields"]) for c in cards.calls}
    assert counts == {"compact": 0, "small": 0, "medium": 2, "large": 4}


@pytest.mark.parametrize(
    ("mode", "count"), [("small", 0), ("medium", 2), ("large", 4)]
)
def test_hover_sends_the_card_at_the_chosen_size(cards, mode, count):
    card(CardView(PLANT, size="small", on_hover=mode))
    data = cards.data
    assert (data["onHover"], data["size"]) == (mode, "small")
    assert data["hover"]["size"] == mode
    assert data["hover"]["fields"] == [
        [f.label, f.value] for f in PLANT.fields[:count]
    ]
    assert data["hover"]["caption"] == ["Planted", "2026-10-01"]


def test_hover_follows_the_config_and_can_be_disabled(cards):
    config = card_config.LedgerCard(headline="Height", max_fields=1)
    card(CardView(PLANT, config, on_hover="large"))
    hover = cards.data["hover"]
    assert hover["headline"] == ["Height", "12 cm"]
    assert hover["fields"] == [["Light", "Full sun"]]

    card(CardView(PLANT, on_hover="disabled"), key="off")
    assert (cards.data["onHover"], cards.data["hover"]) == ("disabled", None)


def test_hover_can_show_another_record_and_variant(cards):
    detail = Record(
        "Plant", "Basil, in full", id="P-9", fields={"Water": "Daily"}
    )
    hover = CardView(
        detail, card_config.PropertyCard(layout="split"), size="large"
    )
    card(CardView(PLANT, "ledger", size="small", on_hover=hover), disabled=True)
    data = cards.data
    assert (data["variant"], data["onHover"], data["title"]) == (
        "ledger",
        "large",
        [None, "Basil"],
    )
    shown = data["hover"]
    assert (shown["variant"], shown["size"], shown["layout"]) == (
        "property",
        "large",
        "split",
    )
    assert (shown["title"], shown["fields"]) == (
        [None, "Basil, in full"],
        [["Water", "Daily"]],
    )
    assert shown["disabled"] is True
    assert cards.calls[0]["key"] == "card-ledger:P-1"


def test_a_card_view_keeps_its_config_as_an_object():
    assert CardView(PLANT).card_config == card_config.RecordCard()
    assert CardView(PLANT, "tile").card_config == card_config.TileCard()


def test_click_returns_true_and_calls_on_click(monkeypatch, cards):
    cards.reply = {"click": True}
    seen = []
    assert card(CardView(PLANT), on_click=seen.append, args=("P-1",)) is True
    cards.calls[0]["on_click_change"]()
    assert seen == ["P-1"]


def test_width_options(cards):
    card(CardView(PLANT), width="content", key="a")
    card(CardView(PLANT), width=320, key="b")
    assert [c["width"] for c in cards.calls] == ["content", 320]
    assert cards.calls[0]["data"]["contentWidth"] is True


BAD = {
    "a record with no id and no key": (
        lambda: card(CardView(Record("Plant", "Mint"))),
        "key",
    ),
    "a headline that is not text or a field": (
        lambda: card_config.RecordCard(headline=5),
        "headline",
    ),
    "a header that is the old date slot": (
        lambda: card_config.RecordCard(header="date"),
        "header",
    ),
    "hiding the timestamp, which a card no longer draws": (
        lambda: card_config.RecordCard(hide=["timestamp"]),
        "Cannot hide",
    ),
    "an unknown size": (lambda: card(CardView(PLANT, size="huge")), "size"),
    "an unknown width": (lambda: card(CardView(PLANT), width="auto"), "width"),
    "an unknown hover": (
        lambda: card(CardView(PLANT, on_hover="big")),
        "on_hover",
    ),
    "an unknown status display": (
        lambda: card_config.RecordCard(status_display="text"),
        "status_display",
    ),
    "an unknown card config name": (
        lambda: card(CardView(PLANT, "grid")),
        "grid",
    ),
    "a record in place of a CardView": (lambda: card(PLANT), "CardView"),
    "a hover card with its own hover": (
        lambda: CardView(PLANT, on_hover=CardView(PLANT, on_hover="large")),
        "its own on_hover",
    ),
    "a compact hover card": (
        lambda: CardView(PLANT, on_hover=CardView(PLANT, size="compact")),
        "size",
    ),
}


@pytest.mark.parametrize("case", BAD)
def test_bad_input_fails_where_it_is_written(case, cards):
    call, culprit = BAD[case]
    with pytest.raises((ValueError, TypeError), match=culprit):
        call()
    assert cards.calls == []


def test_a_headline_can_be_a_field_label_or_a_pair(cards):
    card(CardView(PLANT, card_config.LedgerCard(headline="pH")))
    assert cards.data["headline"] == ["pH", 6.5]
    card(
        CardView(
            PLANT, card_config.LedgerCard(headline=RecordField("Days", 12))
        )
    )
    assert cards.data["headline"] == ["Days", 12]
    assert "Height" in [name for name, _ in cards.data["fields"]]


def test_the_text_slots_take_text_or_a_labeled_field(cards):
    order = Record(
        "Sales Order",
        RecordField("Sales Order", "1234567"),
        id="SO-1",
        subtitle=("Customer", "Acme Corp"),
        caption="Billed in October",
    )
    card(CardView(order))
    data = cards.data
    assert data["title"] == ["Sales Order", "1234567"]
    assert data["subtitle"] == ["Customer", "Acme Corp"]
    assert data["caption"] == [None, "Billed in October"]
    assert "date" not in data and "dates" not in data

    card(CardView(PLANT), key="plain")
    assert cards.data["title"] == [None, "Basil"]
    assert cards.data["subtitle"] == [None, "Window box"]


def test_the_caption_can_take_the_header_slot(cards):
    card(CardView(PLANT, card_config.RecordCard(header="caption")))
    assert cards.data["header"] == "caption"


def test_the_timestamp_is_not_drawn_by_a_card(cards):
    dated = Record(
        "Plant", "Mint", id="P-3", timestamp=datetime(2031, 1, 2, 3, 4)
    )
    card(CardView(dated, size="large"))
    assert "2031" not in str(cards.data)


HEADLINE_VARIANTS = [
    card_config.RecordCard,
    card_config.TileCard,
    card_config.PropertyCard,
    card_config.LedgerCard,
]


@pytest.mark.parametrize("config", HEADLINE_VARIANTS)
@pytest.mark.parametrize("size", ["small", "compact"])
def test_a_small_card_shows_a_named_headline_as_its_value(cards, config, size):
    card(CardView(PLANT, config(headline="Height"), size=size))
    assert cards.data["headline"] == [None, "12 cm"]
    if size == "small":
        assert len(cards.data["fields"]) == 0


@pytest.mark.parametrize("config", HEADLINE_VARIANTS)
@pytest.mark.parametrize("size", ["small", "compact"])
def test_a_small_card_shows_a_given_headline_with_its_label(
    cards, config, size
):
    card(CardView(PLANT, config(headline=RecordField("Days", 12)), size=size))
    assert cards.data["headline"] == ["Days", 12]


@pytest.mark.parametrize(
    "config",
    [card_config.RecordCard, card_config.TileCard, card_config.PropertyCard],
)
def test_a_headline_is_the_first_field_of_a_larger_card(cards, config):
    card(CardView(PLANT, config(headline="Soil"), size="large"))
    fields = cards.data["fields"]
    assert fields[0] == ["Soil", "Loam"]
    assert [name for name, _ in fields].count("Soil") == 1
    assert [name for name, _ in fields] == ["Soil", "Height", "Light", "pH"]
    assert cards.data["headline"] is None


@pytest.mark.parametrize(
    "config",
    [card_config.RecordCard, card_config.TileCard, card_config.PropertyCard],
)
def test_a_headline_that_is_not_a_field_is_added_in_front(cards, config):
    card(CardView(PLANT, config(headline=("Days", 12)), size="large"))
    fields = cards.data["fields"]
    assert fields[0] == ["Days", 12]
    assert len(fields) == 5


def test_a_given_headline_replaces_the_field_with_its_name(cards):
    card(
        CardView(
            PLANT,
            card_config.RecordCard(headline=("Soil", "Clay")),
            size="large",
        )
    )
    fields = cards.data["fields"]
    assert fields[0] == ["Soil", "Clay"]
    assert [name for name, _ in fields].count("Soil") == 1


@pytest.mark.parametrize("config", HEADLINE_VARIANTS)
@pytest.mark.parametrize("size", ["compact", "small", "medium", "large"])
def test_a_headline_that_names_no_field_leads_with_nothing(cards, config, size):
    card(CardView(PLANT, config(headline="Missing"), size=size), key="x")
    assert cards.data["headline"] is None
    shown = [name for name, _ in cards.data["fields"]]
    assert shown == [f.label for f in PLANT.fields][: len(shown)]


@pytest.mark.parametrize("config", HEADLINE_VARIANTS)
def test_a_headline_without_a_value_leads_with_nothing(cards, config):
    empty = Record("Plant", "Mint", id="P-2", fields={"Height": None})
    card(CardView(empty, config(headline="Height"), size="small"))
    assert cards.data["headline"] is None
    card(
        CardView(
            empty, config(headline=RecordField("Days", None)), size="small"
        ),
        key="y",
    )
    assert cards.data["headline"] is None


def test_a_ledger_draws_its_headline_as_a_labeled_figure(cards):
    card(
        CardView(PLANT, card_config.LedgerCard(headline="Height"), size="large")
    )
    assert cards.data["headline"] == ["Height", "12 cm"]
    assert "Height" not in [name for name, _ in cards.data["fields"]]


@pytest.mark.parametrize("config", HEADLINE_VARIANTS)
@pytest.mark.parametrize("size", ["compact", "small", "medium", "large"])
def test_a_card_without_a_headline_leads_with_nothing(cards, config, size):
    card(CardView(PLANT, config(), size=size), key="x")
    assert cards.data["headline"] is None
    shown = [name for name, _ in cards.data["fields"]]
    assert shown == [f.label for f in PLANT.fields][: len(shown)]
