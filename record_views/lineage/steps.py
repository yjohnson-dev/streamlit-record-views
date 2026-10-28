from __future__ import annotations

from collections.abc import Iterable
from typing import Any, Literal

from record_views.cards.checks import check_choice
from record_views.lineage.payload import graph_payload
from record_views.lineage.view import (
    ORIENTATIONS,
    Height,
    OnSelect,
    Orientation,
    StatusDisplay,
    Width,
    build_graph,
    render_lineage,
)
from record_views.link import Link
from record_views.record import Record

_ORDERS = ("links", "input")


def lineage_steps(
    records: Record | Iterable[Record],
    links: Iterable[Link | tuple[Any, ...]] = (),
    *,
    current: str | None = None,
    order: Literal["links", "input"] = "links",
    orientation: Orientation = "auto",
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
    """Renders records as an ordered sequence of steps.

    Args:
        records: The steps, each with a unique id.
        links: The relations between the records: Link objects, or tuples of
            (record_1, record_2), (record_1, record_2, label), or
            (record_1, record_2, label, directed). A directed link leads
            from record_1, upstream, to record_2, downstream.
        current: The id of the step in progress. Earlier steps show as done
            and later steps as upcoming. None shows every step neutrally.
        order: "links" orders steps so each follows the steps upstream of
            it, keeping the given order where links do not decide; "input"
            keeps the given order.
        orientation: "horizontal" lays steps out in a row, "vertical" in a
            column, and "auto" picks by the available width.
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
        ValueError: If a record has no id, ids repeat, a link names an id that
            no record has or repeats an earlier link, current is not one of the
            records, order or orientation is unsupported, or height, width,
            on_select, or status_display is invalid, or on_select is a
            callback without key.
    """
    check_choice("order", order, _ORDERS)
    check_choice("orientation", orientation, ORIENTATIONS)
    graph = build_graph(records, links)
    steps = graph.ids
    if order == "links":
        steps = graph.sequence(steps)
    if current is not None and current not in steps:
        raise ValueError(f"current {current!r} is not one of the steps.")
    position = steps.index(current) if current is not None else None

    def state(index: int) -> str:
        if position is None:
            return "default"
        if index < position:
            return "done"
        return "current" if index == position else "upcoming"

    states = {node: state(index) for index, node in enumerate(steps)}
    data = {
        **graph_payload(graph, steps, status_display=status_display),
        "steps": steps,
        "states": states,
        "current": current,
        "orientation": orientation,
    }
    return render_lineage(
        "lineage_steps",
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
