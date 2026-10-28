"""Configurations that say how a record looks as a card."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, ClassVar, Literal

from record_views.cards.checks import (
    check_choice,
    check_currency,
    check_hide,
    check_max_fields,
)
from record_views.cards.config import (
    HEADER_SLOTS,
    STATUS_DISPLAYS,
    HeaderSlot,
    StatusDisplay,
)
from record_views.cards.payload import (
    LEDGER_FIELDS,
    PROPERTY_FIELDS,
    STANDARD_FIELDS,
    FieldLimits,
    color_name,
)
from record_views.record import Color, RecordField

__all__ = ["LedgerCard", "PropertyCard", "RecordCard", "TileCard"]

_PROPERTY_LAYOUTS = ("sheet", "chip", "split")
_LEDGER_LAYOUTS = ("statement", "metric", "split")


@dataclass(frozen=True, kw_only=True)
class _CardConfig:
    """Holds the options every card configuration shares."""

    variant: ClassVar[str]
    field_limits: ClassVar[FieldLimits] = STANDARD_FIELDS

    border: bool = True
    background: bool = False
    status_display: StatusDisplay = "full"
    status_badge: bool = False
    header: HeaderSlot = "status"
    hide: Iterable[str] = ()
    max_fields: int | None = None
    color: Color | str | None = None
    icon: str | None = None
    status_color: Color | str | None = None
    headline: str | RecordField | tuple[str, Any] | None = None

    def __post_init__(self) -> None:
        check_choice("header", self.header, HEADER_SLOTS)
        check_choice("status_display", self.status_display, STATUS_DISPLAYS)
        check_max_fields(self.max_fields)
        object.__setattr__(self, "hide", check_hide(self.hide))
        for color in (self.color, self.status_color):
            if color is not None:
                color_name(color)
        headline = self.headline
        if isinstance(headline, tuple):
            object.__setattr__(self, "headline", RecordField(*headline))
        elif headline is not None and not isinstance(
            headline, (str, RecordField)
        ):
            raise TypeError(
                "headline must be a field name, a RecordField, or a "
                f"(label, value) pair, not {headline!r}."
            )


@dataclass(frozen=True, kw_only=True)
class RecordCard(_CardConfig):
    """Describes a full card with a header, a body, and a footer.

    Attributes:
        border: Whether to outline the card with a border.
        background: Whether to fill the card with the secondary background
            color.
        status_display: "full" for the dot and the text, or the badge, which
            reduce to the dot when space runs out; "dot" for only the dot; or
            None to omit the status, as hide=["status"] does.
        status_badge: Whether to render status as a filled badge instead of a
            dot.
        header: Which item ("status", "caption", or None) sits at the right
            of the header. The other moves to the footer, and None puts both
            there. Small cards always draw the caption in their row. At
            compact size, "status" keeps the status on the first line, and
            "caption" or None moves it to the last line.
        hide: Names of elements to omit, any of "status", "subtitle",
            "caption", and "note". Any iterable of names, kept as a tuple.
        max_fields: The number of fields at medium and large size. None shows
            2 at medium size and all at large size. Compact and small sizes
            ignore it and show none.
        color: Overrides the record's color.
        icon: Overrides the record's icon.
        status_color: Overrides the record's status color.
        headline: The field to lead with, or None. A str names a field of the
            record, a RecordField or (label, value) pair gives the field
            itself, and a name that matches no field leads with nothing. At
            small and compact size the headline sits beside the status, and
            beside the last line, showing only its value for a str and its
            label and value for a RecordField. At medium and large size it
            is the first field, which moves to the front of the fields if
            the record has it and is added in front if not.

    Raises:
        TypeError: If hide is a string, or headline is not a string, a
            RecordField, a (label, value) pair, or None.
        ValueError: If header or status_display is not a supported value,
            max_fields is negative or not an integer, hide contains an
            unknown name, or color or status_color is not a supported color.
    """

    variant: ClassVar[str] = "record"


@dataclass(frozen=True, kw_only=True)
class TileCard(_CardConfig):
    """Describes a list-row card led by an accent icon avatar.

    Attributes:
        border: Whether to outline the card with a border.
        background: Whether to fill the card with the secondary background
            color.
        status_display: "full" for the dot and the text, or the badge, which
            reduce to the dot when space runs out; "dot" for only the dot; or
            None to omit the status, as hide=["status"] does.
        status_badge: Whether to render status as a filled badge instead of a
            dot.
        header: Which item ("status", "caption", or None) sits at the right
            of the title line. The other moves to the footer, and None puts
            both there. Small cards always draw the caption in their row.
        hide: Names of elements to omit, any of "status", "subtitle",
            "caption", and "note". Any iterable of names, kept as a tuple.
        max_fields: The number of fields at medium and large size. None shows
            2 at medium size and all at large size. Compact and small sizes
            ignore it and show none.
        color: Overrides the record's color.
        icon: Overrides the record's icon.
        status_color: Overrides the record's status color.
        headline: The field to lead with, or None. A str names a field of the
            record, a RecordField or (label, value) pair gives the field
            itself, and a name that matches no field leads with nothing. At
            small and compact size the headline sits beside the status, and
            beside the last line, showing only its value for a str and its
            label and value for a RecordField. At medium and large size it
            is the first field, which moves to the front of the fields if
            the record has it and is added in front if not.

    Raises:
        TypeError: If hide is a string, or headline is not a string, a
            RecordField, a (label, value) pair, or None.
        ValueError: If header or status_display is not a supported value,
            max_fields is negative or not an integer, hide contains an
            unknown name, or color or status_color is not a supported color.
    """

    variant: ClassVar[str] = "tile"


@dataclass(frozen=True, kw_only=True)
class PropertyCard(_CardConfig):
    """Describes an attribute-forward card that lays fields out as a grid.

    Attributes:
        border: Whether to outline the card with a border.
        background: Whether to fill the card with the secondary background
            color.
        status_display: "full" for the dot and the text, or the badge, which
            reduce to the dot when space runs out; "dot" for only the dot; or
            None to omit the status, as hide=["status"] does.
        status_badge: Whether to render status as a filled badge instead of a
            dot.
        header: Which item ("status", "caption", or None) sits at the right
            of the type line. The other moves to the footer, and None puts
            both there. Small cards always draw the caption in their row. At
            compact size, "status" keeps the status on the first line, and
            "caption" or None moves it to the last line.
        hide: Names of elements to omit, any of "status", "subtitle",
            "caption", and "note". Any iterable of names, kept as a tuple.
        max_fields: The number of fields at medium and large size. None shows
            4 at medium size and all at large size. Compact size ignores it
            and shows the first field; small size shows none.
        color: Overrides the record's color.
        icon: Overrides the record's icon.
        status_color: Overrides the record's status color.
        headline: The field to lead with, or None. A str names a field of the
            record, a RecordField or (label, value) pair gives the field
            itself, and a name that matches no field leads with nothing. At
            small and compact size the headline sits beside the status, and
            beside the last line, showing only its value for a str and its
            label and value for a RecordField. At medium and large size it
            is the first field, which moves to the front of the fields if
            the record has it and is added in front if not.
        layout: Arrangement of the card at medium and large size. "sheet"
            leads with the title over a muted type and status line, "chip"
            leads with a colored type chip, and "split" places the identity
            beside the spec grid when there is room, with the description
            filling the space beside the specs.
        description: Long-form text such as a memo, shown at medium and large
            size in a block cut to a few lines that fades when there is more.

    Raises:
        TypeError: If hide is a string, or headline is not a string, a
            RecordField, a (label, value) pair, or None.
        ValueError: If header, status_display, or layout is not a supported
            value, max_fields is negative or not an integer, hide contains
            an unknown name, or color or status_color is not a supported
            color.
    """

    variant: ClassVar[str] = "property"
    field_limits: ClassVar[FieldLimits] = PROPERTY_FIELDS

    layout: Literal["sheet", "chip", "split"] = "sheet"
    description: str | None = None

    def __post_init__(self) -> None:
        super().__post_init__()
        check_choice("layout", self.layout, _PROPERTY_LAYOUTS)


@dataclass(frozen=True, kw_only=True)
class LedgerCard(_CardConfig):
    """Describes a quantified card led by a headline figure.

    Attributes:
        border: Whether to outline the card with a border.
        background: Whether to fill the card with the secondary background
            color.
        status_display: "full" for the dot and the text, or the badge, which
            reduce to the dot when space runs out; "dot" for only the dot; or
            None to omit the status, as hide=["status"] does.
        status_badge: Whether to render status as a filled badge instead of a
            dot.
        header: Which item ("status", "caption", or None) sits at the right
            of the type line. The other moves to the footer, and None puts
            both there. Small cards always draw the caption in their row. At
            compact size, "status" keeps the status on the first line, and
            "caption" or None moves it to the last line.
        hide: Names of elements to omit, any of "status", "subtitle",
            "caption", and "note". Any iterable of names, kept as a tuple.
        max_fields: The number of itemized fields at medium and large size.
            None shows 3 at medium size and all at large size. Compact and
            small sizes ignore it and show none.
        color: Overrides the record's color.
        icon: Overrides the record's icon.
        status_color: Overrides the record's status color.
        headline: The figure the card leads with, or None for no figure. A
            str names a field of the record, a RecordField or (label, value)
            pair gives the figure itself, and a name that matches no field
            leads with nothing. Medium and large cards draw it as a large
            figure taken out of the itemized fields, which are the numeric
            fields; text fields are listed below them. Small and compact
            cards place it beside the status and on the last line, showing
            only its value for a str and its label and value for a
            RecordField.
        layout: Arrangement of the card at medium and large size.
            "statement" itemizes fields as receipt lines, "metric" shows them
            as stat blocks under the headline, and "split" places the
            itemization beside the headline when there is room.
        currency: An ISO 4217 code, such as "USD", that formats numeric
            values as currency in the viewer's locale. None formats them as
            plain numbers.
        accounting: Whether to present numeric values in accounting style:
            currency symbols and amounts in aligned columns, and negatives in
            parentheses.

    Raises:
        TypeError: If hide is a string, or headline is not a string, a
            RecordField, a (label, value) pair, or None.
        ValueError: If header, status_display, or layout is not a supported
            value, max_fields is negative or not an integer, hide contains
            an unknown name, color or status_color is not a supported color,
            or currency is not a three-letter code.
    """

    variant: ClassVar[str] = "ledger"
    field_limits: ClassVar[FieldLimits] = LEDGER_FIELDS

    layout: Literal["statement", "metric", "split"] = "statement"
    currency: str | None = None
    accounting: bool = False

    def __post_init__(self) -> None:
        super().__post_init__()
        check_choice("layout", self.layout, _LEDGER_LAYOUTS)
        object.__setattr__(self, "currency", check_currency(self.currency))
