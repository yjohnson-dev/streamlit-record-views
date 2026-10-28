from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from record_views.record import Color, Record, RecordField
from record_views.utils import clean_value, is_missing, iter_rows


@dataclass(frozen=True)
class RecordStyle:
    """The look of one record type.

    Attributes:
        icon: Streamlit icon or Material Symbol identifier.
        color: Theme color name or CSS/hex color string.
        status_colors: Status color by status text for this type. It takes
            precedence over the status_colors argument of records_from_frame.
    """

    icon: str | None = None
    color: Color | str = Color.GRAY
    status_colors: Mapping[str, Color | str] = field(default_factory=dict)


def records_from_frame(
    frame: Any,
    *,
    title: str | tuple[str, str],
    record_type: str | None = None,
    type_column: str | None = None,
    id: str | None = None,
    id_prefix: str = "",
    subtitle: str | tuple[str, str] | None = None,
    caption: str | tuple[str, str] | None = None,
    status: str | None = None,
    timestamp: str | None = None,
    note: str | None = None,
    fields: Iterable[str] | Mapping[str, str] = (),
    styles: Mapping[str, RecordStyle] | None = None,
    status_colors: Mapping[str, Color | str] | None = None,
    keep_missing: bool = False,
) -> list[Record]:
    """Builds one record per row of a dataframe, mapping columns by name.

    Args:
        frame: A pandas or polars DataFrame, or an iterable of mappings.
        title: The column of record titles, or a (label, column) pair for a
            labeled title.
        record_type: The record type of every row. Give this or type_column.
        type_column: The column of record types. Give this or record_type.
        id: The column of record ids. A whole float, such as 5001.0 from a
            column with missing values, becomes "5001".
        id_prefix: Text put before every id, such as "case-", so that ids
            of different record types do not collide.
        subtitle: The column of subtitles, or a (label, column) pair for a
            labeled subtitle.
        caption: The column of captions, or a (label, column) pair for a
            labeled caption.
        status: The column of status texts.
        timestamp: The column of dates or datetimes that place the records
            in time order. Cards do not draw it; map a caption to show a date.
        note: The column of notes.
        fields: The field columns: a list of column names, used as labels,
            or a mapping of label to column name.
        styles: The icon, color, and status colors for each record type.
        status_colors: The status color for each status text, for all
            record types. Statuses not listed are gray.
        keep_missing: Whether to keep fields whose value is missing. By
            default they are left out, so cards do not show "None".

    Returns:
        The records, in row order.

    Raises:
        ValueError: If not exactly one of record_type and type_column is
            given, a named column does not exist, or a row has no title or
            record type.
    """
    if (record_type is None) == (type_column is None):
        raise ValueError("Give exactly one of record_type and type_column.")
    if isinstance(fields, Mapping):
        field_columns = dict(fields)
    else:
        field_columns = {column: column for column in fields}
    styles = styles or {}
    status_colors = status_colors or {}

    records = []
    for number, row in enumerate(iter_rows(frame)):

        def cell(column: str | None) -> Any:
            if column is None:
                return None
            try:
                value = row[column]
            except KeyError:
                raise ValueError(f"No column {column!r}.") from None
            return None if is_missing(value) else value

        def slot(spec: str | tuple[str, str] | None) -> Any:
            if isinstance(spec, tuple):
                label, column = spec
                return RecordField(label, cell(column))
            return cell(spec)

        kind = record_type if type_column is None else cell(type_column)
        style = styles.get(str(kind), RecordStyle())
        state = clean_value(cell(status))
        record_id = cell(id)
        if isinstance(record_id, float) and record_id.is_integer():
            record_id = int(record_id)
        values = {label: cell(c) for label, c in field_columns.items()}
        try:
            records.append(
                Record(
                    kind,
                    slot(title),
                    id=None if record_id is None else f"{id_prefix}{record_id}",
                    subtitle=slot(subtitle),
                    caption=slot(caption),
                    status=state,
                    status_color=style.status_colors.get(
                        state, status_colors.get(state, Color.GRAY)
                    ),
                    color=style.color,
                    icon=style.icon,
                    timestamp=cell(timestamp),
                    note=cell(note),
                    fields={
                        label: value
                        for label, value in values.items()
                        if keep_missing or value is not None
                    },
                )
            )
        except ValueError as error:
            raise ValueError(f"Row {number}: {error}") from None
    return records
