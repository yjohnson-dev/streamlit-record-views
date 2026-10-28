from __future__ import annotations

from collections.abc import Iterable
from dataclasses import KW_ONLY, dataclass
from typing import Any

from record_views.record import Record
from record_views.utils import clean_value, is_missing, iter_rows


@dataclass(frozen=True)
class Link:
    """Represents a relation between two records.

    Attributes:
        record_1: The first record, or its id. A Record needs an id. The
            attribute holds the id as text.
        record_2: The second record, or its id. The attribute holds the id as
            text.
        label: Optional text that names the relation, such as "fulfilled by".
            Blank text and NaN-like values become None.
        directed: True if record_1 comes first and leads to record_2, so
            record_1 is upstream and record_2 is downstream. False if the two
            records are related without an order. Keyword only.

    Raises:
        ValueError: If a record is missing or has no id, if directed is not
            True or False, or if both ends are the same record.
    """

    record_1: str
    record_2: str
    label: str | None = None
    _: KW_ONLY
    directed: bool = True

    def __post_init__(self) -> None:
        for name in ("record_1", "record_2"):
            value = getattr(self, name)
            if isinstance(value, Record):
                if value.id is None:
                    raise ValueError(
                        f"Link {name} is the record {value.title!r}, "
                        "which has no id."
                    )
                value = value.id
            text = clean_value(value)
            if not text:
                raise ValueError(f"Link {name} is required.")
            object.__setattr__(self, name, text)
        if self.record_1 == self.record_2:
            raise ValueError(f"Record {self.record_1!r} links to itself.")
        object.__setattr__(self, "label", clean_value(self.label) or None)
        object.__setattr__(self, "directed", _flag(self.directed))

    @classmethod
    def from_frame(
        cls,
        frame: Any,
        *,
        record_1: str,
        record_2: str,
        label: str | None = None,
        directed: bool | str = True,
    ) -> list[Link]:
        """Builds one link per row of a dataframe, mapping columns by name.

        Args:
            frame: A pandas or polars DataFrame, or an iterable of mappings.
            record_1: The column of first record ids. A whole float, such as
                5001.0 from a column with missing values, becomes "5001".
            record_2: The column of second record ids.
            label: The column of labels.
            directed: True or False for every row, or the name of a column
                of booleans. A missing value in that column counts as True.

        Returns:
            The links, in row order. A row where record_1 or record_2 is
            missing is skipped.

        Raises:
            ValueError: If a named column does not exist, a row links a record
                to itself, or a directed value is not True or False.
        """
        names = {"record_1": record_1, "record_2": record_2}
        if label is not None:
            names["label"] = label
        if isinstance(directed, str):
            names["directed"] = directed
        columns = getattr(frame, "columns", None)
        if columns is not None:
            for column in names.values():
                if column not in columns:
                    raise ValueError(f"No column {column!r}.")

        links = []
        for number, row in enumerate(iter_rows(frame)):

            def cell(column: str) -> Any:
                try:
                    return row[column]
                except KeyError:
                    raise ValueError(f"No column {column!r}.") from None

            first, second = _id_text(cell(record_1)), _id_text(cell(record_2))
            if first is None or second is None:
                continue
            flag = directed
            if isinstance(directed, str):
                value = cell(directed)
                flag = True if is_missing(value) else value
            try:
                links.append(
                    cls(
                        first,
                        second,
                        None if label is None else cell(label),
                        directed=flag,
                    )
                )
            except ValueError as error:
                raise ValueError(f"Row {number}: {error}") from None
        return links


def _flag(value: Any) -> bool:
    """Checks that a directed value is True or False."""
    if (
        is_missing(value)
        or isinstance(value, str)
        or value not in (True, False)
    ):
        raise ValueError(f"directed must be True or False, not {value!r}.")
    return bool(value)


def _id_text(value: Any) -> str | None:
    """Writes a cell as an id, or None if it is missing or blank."""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return clean_value(value) or None


def coerce_links(links: Any) -> list[Link]:
    """Converts a caller-supplied collection into a list of links.

    Args:
        links: None, or an iterable of Link objects and tuples. A tuple is
            (record_1, record_2), (record_1, record_2, label), or
            (record_1, record_2, label, directed).

    Returns:
        The links, in the order given.

    Raises:
        TypeError: If links is not an iterable, is a string or a dataframe,
            or an item is neither a Link nor a tuple.
        ValueError: If a tuple does not have two to four values, or an item
            is not a valid link.
    """
    if links is None:
        return []
    if hasattr(links, "to_dict") or hasattr(links, "to_dicts"):
        raise TypeError(
            "links cannot be a dataframe. Build the links with "
            "Link.from_frame(frame, record_1=..., record_2=...)."
        )
    if isinstance(links, str) or not isinstance(links, Iterable):
        raise TypeError(
            "links must be an iterable of Link objects or tuples, "
            f"not {type(links).__name__}."
        )
    out = []
    for number, item in enumerate(links):
        if isinstance(item, Link):
            out.append(item)
        elif isinstance(item, tuple):
            if not 2 <= len(item) <= 4:
                raise ValueError(
                    f"links[{number}] must be (record_1, record_2), "
                    "(record_1, record_2, label), or "
                    f"(record_1, record_2, label, directed), not {item!r}."
                )
            directed = item[3] if len(item) == 4 else True
            try:
                out.append(Link(*item[:3], directed=directed))
            except ValueError as error:
                raise ValueError(f"links[{number}]: {error}") from None
        else:
            raise TypeError(
                f"links[{number}] must be a Link or a tuple, not "
                f"{type(item).__name__}."
            )
    return out
