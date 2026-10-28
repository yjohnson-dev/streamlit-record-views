from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from record_views.cards.config import OnHover
from record_views.cards.view import CardSpec
from record_views.lineage.payload import graph_payload
from record_views.lineage.view import (
    Height,
    OnSelect,
    StatusDisplay,
    Width,
    build_graph,
    render_lineage,
)
from record_views.link import Link
from record_views.record import Record


def lineage_trail(
    records: Record | Iterable[Record],
    links: Iterable[Link | tuple[Any, ...]] = (),
    *,
    focus: str,
    downstream: bool = True,
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
    card_config: CardSpec = None,
    on_hover: OnHover = "medium",
) -> str | None:
    """Renders a record's lineage as a one-line breadcrumb trail.

    Args:
        records: The records to connect, each with a unique id.
        links: The relations between the records: Link objects, or tuples of
            (record_1, record_2), (record_1, record_2, label), or
            (record_1, record_2, label, directed). A directed link leads
            from record_1, upstream, to record_2, downstream.
        focus: The id of the record the trail leads to.
        downstream: Whether to continue past the focus while its lineage
            does not branch.
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
            or None to omit statuses. A card_config with its own
            status_display wins.
        card_config: How each record looks: a card_config.RecordCard,
            TileCard, PropertyCard, or LedgerCard object; one of the names
            "record", "tile", "property", and "ledger"; or None for this
            component's own choice of card. Records are drawn at compact
            size.
        on_hover: What hovering or focusing a record shows above the
            component: "small", "medium", or "large" shows the record as a
            card of that size, None shows the compact card in full when its
            content is cut off, and "disabled" shows nothing.

    Returns:
        The id of the selected record, or None if nothing is selected.

    Raises:
        TypeError: If links is not an iterable of Link objects or tuples, or
            card_config is not a supported value.
        ValueError: If a record has no id, ids repeat, a link names an id that
            no record has or repeats an earlier link, focus is not one of the
            records, or height, width, on_select, status_display, or
            on_hover is invalid, or on_select is a callback without key.
    """
    graph = build_graph(records, links)
    graph.require(focus)
    trail = graph.path_to(focus)
    if downstream:
        trail += graph.path_from(focus)[1:]
    data = {
        **graph_payload(
            graph,
            trail,
            card_config=card_config,
            on_hover=on_hover,
            status_display=status_display,
        ),
        "trail": trail,
        "focus": focus,
    }
    return render_lineage(
        "lineage_trail",
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
