from __future__ import annotations

import functools
from collections.abc import Callable
from dataclasses import replace
from typing import Any, Literal

import streamlit as st

from record_views.card_config import (
    LedgerCard,
    PropertyCard,
    RecordCard,
    TileCard,
)
from record_views.cards.config import CardSize, Width
from record_views.cards.payload import build_card_payload, field_value
from record_views.record import Record, RecordField

CardConfig = RecordCard | TileCard | PropertyCard | LedgerCard
CardName = Literal["record", "tile", "property", "ledger"]
CardSpec = CardConfig | CardName | None

_BY_NAME: dict[str, type[CardConfig]] = {
    "record": RecordCard,
    "tile": TileCard,
    "property": PropertyCard,
    "ledger": LedgerCard,
}


@functools.cache
def card_component() -> Callable[..., Any]:
    """Registers the CCv2 card component on first use; it draws every variant.

    Returns:
        The component callable.
    """
    return st.components.v2.component(
        "streamlit-record-views.card",
        js="card-*.js",
        css="card-*.css",
        html='<div class="card-root"></div>',
    )


def resolve_config(card_config: CardSpec) -> CardConfig:
    """Turns a card configuration argument into a configuration object.

    Args:
        card_config: A configuration object, one of the names "record",
            "tile", "property", and "ledger", or None.

    Returns:
        The object given, the named class with its defaults, or RecordCard()
        for None.

    Raises:
        TypeError: If card_config is none of those.
    """
    if card_config is None:
        return RecordCard()
    if isinstance(
        card_config, (RecordCard, TileCard, PropertyCard, LedgerCard)
    ):
        return card_config
    if isinstance(card_config, str) and card_config in _BY_NAME:
        return _BY_NAME[card_config]()
    raise TypeError(
        "card_config must be a card_config object, one of "
        f"{tuple(_BY_NAME)}, or None, not {card_config!r}."
    )


def resolve_headline(
    config: CardConfig, record: Record, size: CardSize
) -> tuple[list[Any] | None, Record]:
    """Resolves a card's headline for one size.

    Args:
        config: How the record looks, which holds the headline.
        record: The record whose fields the headline leads.
        size: Presentation size ("compact", "small", "medium", or "large").

    Returns:
        The headline as [label, value], or None when there is no headline or
        it has no value, and the record with the fields to draw. A LedgerCard draws the headline as a figure taken
        out of the itemized fields. Other cards at medium and large size draw
        it as the first field, so they return no separate headline. Where a
        card draws the headline on its own, small and compact size, the label
        is None unless the config gave a RecordField, so a name shows only
        the value.
    """
    spec = config.headline
    ledger = isinstance(config, LedgerCard)
    labeled = isinstance(spec, RecordField)
    if labeled:
        field = spec
    elif isinstance(spec, str):
        field = next((f for f in record.fields if f.label == spec), None)
    else:
        field = None
    if field is None or field.value is None:
        return None, record
    others = tuple(f for f in record.fields if f.label != field.label)
    if not ledger and size in ("medium", "large"):
        return None, replace(record, fields=(field, *others))
    standalone = ledger and size in ("medium", "large")
    label = field.label if labeled or standalone else None
    if ledger:
        record = replace(record, fields=others)
    return [label, field_value(field.value)], record


def view_payload(
    config: CardConfig,
    record: Record,
    size: CardSize,
    *,
    disabled: bool = False,
) -> dict[str, Any]:
    """Builds the payload that draws a record as a card of one size.

    Args:
        config: How the record looks.
        record: The record metadata and fields to display.
        size: Presentation size ("compact", "small", "medium", or "large").
        disabled: Whether the card is rendered in an inactive state.

    Returns:
        A dictionary conforming to the frontend ViewData interface, without
        the entries that place the card.

    Raises:
        ValueError: If the record's color or status color is not a supported
            color.
    """
    headline, record = resolve_headline(config, record, size)
    hidden = set(config.hide)
    if config.status_display is None:
        hidden.add("status")
    shown = replace(
        record,
        color=config.color or record.color,
        icon=config.icon or record.icon,
        status_color=config.status_color or record.status_color,
        **{name: None for name in hidden},
    )
    payload = build_card_payload(
        shown,
        size,
        config.field_limits,
        status_badge=config.status_badge,
        max_fields=config.max_fields,
        disabled=disabled,
    )
    payload.update(
        header=config.header,
        statusDisplay=config.status_display,
        background=config.background,
        border=config.border,
        headline=headline,
    )
    if isinstance(config, PropertyCard):
        payload.update(layout=config.layout, description=config.description)
    elif isinstance(config, LedgerCard):
        payload.update(
            layout=config.layout,
            accounting=config.accounting,
            currency=config.currency,
        )
    return payload


def render_view(
    payload: dict[str, Any],
    *,
    key: str,
    width: Width,
    on_click: Callable[..., Any] | None,
    args: tuple[Any, ...] | None,
    kwargs: dict[str, Any] | None,
    component: Callable[..., Any] | None = None,
) -> bool:
    """Mounts the card component.

    Args:
        payload: The component payload, whose variant picks the layout.
        key: A unique component key.
        width: "stretch" to fill the container, "content" to fit the card's
            content, or a width in pixels.
        on_click: Callback executed when the card is clicked.
        args: Positional arguments passed to on_click.
        kwargs: Keyword arguments passed to on_click.
        component: The component callable to render with; defaults to the
            registered card component.

    Returns:
        True if the card was clicked in the current script run, False otherwise.
    """

    def _clicked() -> None:
        if on_click is not None:
            on_click(*(args or ()), **(kwargs or {}))

    result = (component or card_component())(
        key=key,
        data=payload,
        on_click_change=_clicked,
        width=width,
    )
    if isinstance(result, dict):
        return bool(result.get("click", False))
    return bool(getattr(result, "click", False))
