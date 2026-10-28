from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

from record_views.cards.config import HIDEABLE, Width


def check_choice(name: str, value: Any, choices: tuple[Any, ...]) -> None:
    """Validates that an argument is one of a fixed set of values.

    Args:
        name: The argument name, for the error message.
        value: The value given.
        choices: The accepted values.

    Raises:
        ValueError: If value is not one of choices.
    """
    if value not in choices:
        raise ValueError(f"{name} must be one of {choices}.")


def check_width(width: Width) -> None:
    """Validates a Streamlit-style width.

    Args:
        width: "stretch", "content", or a positive number of pixels.

    Raises:
        ValueError: If width is none of those.
    """
    if width in ("stretch", "content"):
        return
    if isinstance(width, bool) or not isinstance(width, int) or width <= 0:
        raise ValueError(
            f'width must be "stretch", "content", or a positive integer, '
            f"not {width!r}."
        )


def check_hide(hide: Iterable[str]) -> tuple[str, ...]:
    """Validates the names of elements to omit from a card.

    Args:
        hide: Names of elements to omit.

    Returns:
        The names as a tuple.

    Raises:
        TypeError: If hide is a string.
        ValueError: If hide contains an unknown name.
    """
    if isinstance(hide, str):
        raise TypeError(
            f"hide must be a list of names, such as [{hide!r}], not a string."
        )
    names = tuple(hide)
    if unknown := frozenset(names) - HIDEABLE:
        raise ValueError(
            f"Cannot hide {sorted(unknown)}; choose from {sorted(HIDEABLE)}."
        )
    return names


def check_max_fields(max_fields: int | None) -> None:
    """Validates the number of fields a card shows.

    Args:
        max_fields: None, or a count of 0 or more.

    Raises:
        ValueError: If max_fields is negative or not an integer.
    """
    if max_fields is not None and (
        isinstance(max_fields, bool)
        or not isinstance(max_fields, int)
        or max_fields < 0
    ):
        raise ValueError(
            f"max_fields must be None or an integer of 0 or more, not "
            f"{max_fields!r}."
        )


def check_currency(currency: str | None) -> str | None:
    """Validates and normalizes an ISO 4217 currency code.

    Args:
        currency: A three-letter code, or None.

    Returns:
        The code in uppercase, or None.

    Raises:
        ValueError: If currency is not a three-letter code.
    """
    if currency is None:
        return None
    if not isinstance(currency, str) or not re.fullmatch(
        r"[A-Za-z]{3}", currency
    ):
        raise ValueError(
            f"currency must be an ISO 4217 code such as 'USD', not "
            f"{currency!r}."
        )
    return currency.upper()
