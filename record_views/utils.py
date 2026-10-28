from __future__ import annotations

import numbers
from collections.abc import Iterable
from decimal import Decimal
from typing import Any

FieldValue = str | int | float | Decimal | None


def is_missing(value: Any) -> bool:
    """Reports whether a value is a missing-value marker.

    Args:
        value: Any scalar, typically from a dict or a dataframe row.

    Returns:
        True for None, float NaN, and pandas NaT or NA; False otherwise.
    """
    if value is None:
        return True
    if type(value).__name__ in {"NAType", "NaTType"}:
        return True
    return isinstance(value, float) and value != value


def clean_value(value: Any) -> str | None:
    """Converts a raw value into display text, mapping missing values to None.

    Args:
        value: Any scalar, typically from a dict or a dataframe row.

    Returns:
        The stripped string form of the value, or None if it is missing
        (None, float NaN, pandas NaT or NA).
    """
    if is_missing(value):
        return None
    return str(value).strip()


def clean_field_value(value: Any) -> FieldValue:
    """Normalizes a field value, keeping numbers as numbers.

    Args:
        value: Any scalar, typically from a dict or a dataframe row.

    Returns:
        None if the value is missing; an int, float, or Decimal for numbers,
        including NumPy numbers; otherwise the stripped string form. Booleans
        are treated as text.
    """
    if is_missing(value) or (isinstance(value, Decimal) and value.is_nan()):
        return None
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, Decimal):
        return value
    if isinstance(value, numbers.Integral):
        return int(value)
    if isinstance(value, numbers.Real):
        return float(value)
    return str(value).strip()


def iter_rows(frame: Any) -> Iterable[Any]:
    """Iterates a DataFrame as row mappings, or any iterable as it is.

    Args:
        frame: A pandas or polars DataFrame, or an iterable of mappings.

    Returns:
        The rows, each a mapping from column name to value for a DataFrame.
    """
    if hasattr(frame, "to_dicts"):
        return frame.to_dicts()
    if hasattr(frame, "to_dict"):
        return frame.to_dict("records")
    return frame
