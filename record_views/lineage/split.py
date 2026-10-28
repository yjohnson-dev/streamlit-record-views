from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from record_views.cards.checks import check_choice
from record_views.lineage.payload import field_number, graph_payload
from record_views.lineage.view import (
    DIRECTIONS,
    Direction,
    Height,
    OnSelect,
    StatusDisplay,
    Width,
    build_graph,
    render_lineage,
)
from record_views.link import Link
from record_views.record import Record


def lineage_split(
    records: Record | Iterable[Record],
    links: Iterable[Link | tuple[Any, ...]] = (),
    *,
    focus: str,
    value: str,
    direction: Direction = "downstream",
    label: str | None = None,
    key: str | None = None,
    selected: str | None = None,
    on_select: OnSelect = "rerun",
    args: tuple[Any, ...] | None = None,
    kwargs: dict[str, Any] | None = None,
    height: Height = "content",
    width: Width = "stretch",
    border: bool = False,
    background: bool = False,
    status_display: StatusDisplay = "full",
) -> str | None:
    """Renders how a record's quantity divides into, or gathers from, others.

    Args:
        records: The records to connect, each with a unique id.
        links: The relations between the records: Link objects, or tuples of
            (record_1, record_2), (record_1, record_2, label), or
            (record_1, record_2, label, directed). A directed link leads
            from record_1, upstream, to record_2, downstream.
        focus: The id of the record being divided or gathered.
        value: The label of the numeric field to reconcile, such as
            "Quantity" or "Amount". The view shows the share each record
            takes, and any remainder or excess against the focus. The
            values must be numbers or None.
        direction: "downstream" shows how the focus splits into the records
            after it, such as an order into shipments; "upstream" shows how
            it gathers the records before it, such as a consolidated invoice.
        label: Text shown above the component, or None for none.
        key: A unique component key. Provide one to keep the selection when
            the records change, to set the selection from code, or to use
            an on_select callback.
        selected: The selected record id. With a key, a new value replaces
            the user's selection, and None clears it.
        on_select: "rerun" to rerun the script when the user changes the
            selection, a callback called with the selected id (or None)
            before that rerun, or "ignore" to show records without
            selection.
        args: Positional arguments passed to on_select after the id.
        kwargs: Keyword arguments passed to on_select.
        height: "content" to fit the content, or a height in pixels.
        width: "stretch" to fill the container, "content" to fit the
            content, or a width in pixels.
        border: Whether to frame the component with a border, as
            st.container(border=True) does.
        background: Whether to fill the component with the secondary
            background color.
        status_display: "full" for each record's status dot and text, with
            the text dropped where it does not fit; "dot" for only the dot;
            or None to omit statuses.

    Returns:
        The id of the selected record, or None if nothing is selected.

    Raises:
        TypeError: If links is not an iterable of Link objects or tuples.
        ValueError: If a value field holds text, a record has no id, ids
            repeat, a link names an id that no record has or repeats an
            earlier link, focus is not one of the records, direction is
            unsupported, or height, width, on_select, or status_display is
            invalid, or on_select is a callback without key.
    """
    check_choice("direction", direction, DIRECTIONS)
    graph = build_graph(records, links)
    graph.require(focus)
    parts = (
        graph.children(focus)
        if direction == "downstream"
        else graph.parents(focus)
    )
    members = [focus, *parts]
    data = {
        **graph_payload(graph, members, status_display=status_display),
        "focus": focus,
        "parts": parts,
        "direction": direction,
        "value": value,
        "values": {
            node: field_number(graph.record(node), value) for node in members
        },
    }
    return render_lineage(
        "lineage_split",
        data,
        key=key,
        label=label,
        selected=selected,
        on_select=on_select,
        args=args,
        kwargs=kwargs,
        height=height,
        width=width,
        border=border,
        background=background,
        status_display=status_display,
    )
