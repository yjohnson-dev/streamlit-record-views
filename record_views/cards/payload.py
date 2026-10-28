from __future__ import annotations

import re
from collections.abc import Mapping
from decimal import Decimal
from typing import Any

from record_views.cards.config import CardSize
from record_views.record import Color, Record, RecordField

FieldLimits = Mapping[CardSize, int | None]

# Fields shown at each size; None shows all.
STANDARD_FIELDS: FieldLimits = {
    "compact": 0,
    "small": 0,
    "medium": 2,
    "large": None,
}
PROPERTY_FIELDS: FieldLimits = {
    "compact": 1,
    "small": 0,
    "medium": 4,
    "large": None,
}
LEDGER_FIELDS: FieldLimits = {
    "compact": 0,
    "small": 0,
    "medium": 3,
    "large": None,
}

ABSENT = "None"
_PALETTE = frozenset(color.value for color in Color)
_CSS_COLOR = re.compile(
    r"#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})"
    r"|(?:rgba?|hsla?|oklch)\([0-9a-z.,%/+\- ]+\)",
    re.IGNORECASE,
)


def color_name(value: Color | str) -> str:
    """Normalizes a palette color or CSS color into the frontend form.

    Args:
        value: A Color member, palette name, hex color, or rgb(), hsl(), or
            oklch() color string.

    Returns:
        The lowercase palette name, or the stripped CSS color string.

    Raises:
        ValueError: If value is neither a palette name nor a supported CSS
            color.
    """
    text = str(value).strip()
    if text.lower() in _PALETTE:
        return text.lower()
    if _CSS_COLOR.fullmatch(text):
        return text
    raise ValueError(
        f"Unsupported color {text!r}; use one of {sorted(_PALETTE)}, a hex "
        "color, or an rgb(), hsl(), or oklch() string."
    )


def drawn_fields(
    record: Record,
    size: CardSize,
    limits: FieldLimits = STANDARD_FIELDS,
    max_fields: int | None = None,
) -> tuple[RecordField, ...]:
    """Selects the fields to render at a size.

    Args:
        record: The record containing candidate fields.
        size: The presentation size of the card.
        limits: The card's field count per size.
        max_fields: The number of fields at medium and large size, in place
            of the size's limit. Compact and small sizes ignore it.

    Returns:
        A tuple of fields to display in the card body.
    """
    limit = limits[size]
    if max_fields is not None and size in ("medium", "large"):
        limit = max_fields
    return record.fields if limit is None else record.fields[:limit]


def field_value(value: Any) -> str | int | float | None:
    """Converts a field value into a JSON-serializable form.

    Args:
        value: A normalized RecordField value.

    Returns:
        The value, with a Decimal converted to a float.
    """
    return float(value) if isinstance(value, Decimal) else value


def slot_payload(
    value: str | RecordField | None,
) -> list[str | int | float | None] | None:
    """Converts a title, subtitle, or caption into its payload form.

    Args:
        value: Text, a RecordField, or None.

    Returns:
        None for an empty slot, otherwise [label, value], where the label is
        None for plain text.
    """
    if value is None:
        return None
    if isinstance(value, RecordField):
        return [value.label or None, field_value(value.value)]
    return [None, value]


def build_card_payload(
    record: Record,
    size: CardSize,
    field_limits: FieldLimits = STANDARD_FIELDS,
    *,
    status_badge: bool = False,
    max_fields: int | None = None,
    disabled: bool = False,
) -> dict[str, Any]:
    """Constructs the JSON-serializable dictionary payload for CCv2 cards.

    Args:
        record: The record to serialize.
        size: The presentation size of the card.
        field_limits: The card's field count per size.
        status_badge: Whether status renders as a badge instead of a dot.
        max_fields: The number of fields at medium and large size, in place
            of the size's limit.
        disabled: Whether the card is rendered in an inactive state.

    Returns:
        A dictionary payload conforming to the frontend CardData interface.
    """
    drawn = drawn_fields(record, size, field_limits, max_fields)

    return {
        "size": size,
        "disabled": disabled,
        "recordType": record.record_type,
        "title": slot_payload(record.title),
        "subtitle": slot_payload(record.subtitle),
        "caption": slot_payload(record.caption),
        "color": color_name(record.color),
        "icon": record.icon,
        "status": record.status,
        "statusColor": color_name(record.status_color),
        "statusBadge": status_badge,
        "note": record.note,
        "fields": [[field.label, field_value(field.value)] for field in drawn],
        "absent": ABSENT,
    }
