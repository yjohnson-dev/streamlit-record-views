from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from typing import Any

from record_views.utils import (
    FieldValue,
    clean_field_value,
    clean_value,
    is_missing,
)


class Color(StrEnum):
    """Specifies standard Streamlit palette color names."""

    RED = "red"
    ORANGE = "orange"
    YELLOW = "yellow"
    GREEN = "green"
    BLUE = "blue"
    VIOLET = "violet"
    GRAY = "gray"


@dataclass(frozen=True)
class EntityRef:
    """Represents a business entity, such as a customer or warehouse.

    Attributes:
        name: The display name of the entity.
        entity_type: Optional categorization of the entity.
        identifier: Optional unique identifier of the entity.
    """

    name: str
    entity_type: str | None = None
    identifier: str | None = None


@dataclass(frozen=True)
class RecordField:
    """Represents a key-value attribute of a record.

    Attributes:
        label: The display label of the attribute.
        value: The value, or None if missing. Numbers (int, float, Decimal,
            and NumPy numbers) stay numbers for cards to format; other values
            become stripped text, and NaN-like values become None.
    """

    label: str
    value: FieldValue

    def __post_init__(self) -> None:
        object.__setattr__(self, "label", clean_value(self.label) or "")
        object.__setattr__(self, "value", clean_field_value(self.value))


def _coerce(items: Any, cls: type, *, mapping: bool = False) -> tuple[Any, ...]:
    """Converts a caller-supplied collection into a tuple of cls instances.

    Args:
        items: An iterable of cls instances, strings, or argument tuples. A
            single string is treated as one item. A mapping is accepted when
            `mapping` is True and becomes (key, value) pairs.
        cls: The target dataclass.
        mapping: Whether a Mapping input is expanded into (key, value) pairs.

    Returns:
        A tuple of cls instances.

    Raises:
        TypeError: If items is a string and `mapping` is True.
    """
    if isinstance(items, str):
        if mapping:
            raise TypeError(
                "fields must be a dict or an iterable of RecordField or "
                "(label, value) pairs, not a string."
            )
        items = (items,)
    elif mapping and isinstance(items, Mapping):
        items = items.items()
    out = []
    for item in items:
        if isinstance(item, cls):
            out.append(item)
        elif isinstance(item, str):
            out.append(cls(item))
        else:
            out.append(cls(*item))
    return tuple(out)


def _slot(
    owner: str, value: Any, *, required: bool = False
) -> str | RecordField | None:
    """Normalizes a text slot of a record.

    Args:
        owner: The slot name, for the error message.
        value: Text, a RecordField, or a (label, value) pair.
        required: Whether the slot must have content.

    Returns:
        The stripped text, the RecordField, or None when the slot is empty.

    Raises:
        ValueError: If a required slot is empty.
    """
    if isinstance(value, tuple):
        value = RecordField(*value)
    if isinstance(value, RecordField):
        text = value.value
        if text is not None and text != "":
            return value
    else:
        text = clean_value(value)
        if text:
            return text
    if required:
        raise ValueError(f"Record {owner} is required.")
    return None


@dataclass(frozen=True)
class Record:
    """Represents a canonical business record with metadata.

    The title, subtitle, and caption each take text, or a RecordField that
    pairs a label with the text. Cards draw a labeled title as "label value"
    in one weight, and a labeled subtitle or caption as "label: value" with
    the label in bold.

    Attributes:
        record_type: The domain type name of the record. Required.
        title: The primary display title of the record. Required, and not
            blank.
        id: Optional unique identifier of the record. Lineage components
            and Link objects need it. Like every optional text attribute,
            NaN-like values become None.
        origin: Optional source system or tenant name.
        subtitle: Optional secondary descriptor.
        caption: Optional one-line description that every card shows in
            addition to the title and subtitle, such as a date.
        sources: Entities the record comes from. Accepts names (str),
            EntityRef objects, or EntityRef argument tuples.
        targets: Entities the record goes to. Accepts the same forms as
            sources.
        color: Theme color name or CSS/hex color string. Cards can override
            it.
        icon: Streamlit icon or Material Symbol identifier. Cards can
            override it.
        status: Current operational status label.
        status_color: Status color name or CSS/hex color string. Cards can
            override it.
        timestamp: Creation, transaction, or update timestamp. Lineage
            components use it to place the record in time order, and cards
            do not draw it: put any text to show in the caption. Only a date
            or datetime places the record in time order. NaN-like values
            become None.
        fields: Key-value attributes. Accepts a dict, RecordField objects,
            or (label, value) tuples.
        note: Optional contextual remarks or annotations.

    Raises:
        ValueError: If record_type or title is missing or blank.
        TypeError: If fields is a string.
    """

    record_type: str
    title: str | RecordField | tuple[str, Any]
    id: str | None = None
    origin: str | None = None
    subtitle: str | RecordField | tuple[str, Any] | None = None
    caption: str | RecordField | tuple[str, Any] | None = None
    sources: Iterable[EntityRef | str | tuple[Any, ...]] = ()
    targets: Iterable[EntityRef | str | tuple[Any, ...]] = ()
    color: Color | str = Color.GRAY
    icon: str | None = None
    status: str | None = None
    status_color: Color | str = Color.GRAY
    timestamp: date | datetime | str | None = None
    fields: Mapping[str, Any] | Iterable[RecordField | tuple[Any, ...]] = ()
    note: str | None = None

    def __post_init__(self) -> None:
        text = clean_value(self.record_type)
        if not text:
            raise ValueError("Record record_type is required.")
        object.__setattr__(self, "record_type", text)
        object.__setattr__(
            self, "title", _slot("title", self.title, required=True)
        )
        for name in ("subtitle", "caption"):
            object.__setattr__(self, name, _slot(name, getattr(self, name)))
        for name in ("id", "origin", "icon", "status", "note"):
            object.__setattr__(self, name, clean_value(getattr(self, name)))
        if is_missing(self.timestamp):
            object.__setattr__(self, "timestamp", None)
        for name, cls in (
            ("sources", EntityRef),
            ("targets", EntityRef),
        ):
            object.__setattr__(self, name, _coerce(getattr(self, name), cls))
        object.__setattr__(
            self, "fields", _coerce(self.fields, RecordField, mapping=True)
        )
