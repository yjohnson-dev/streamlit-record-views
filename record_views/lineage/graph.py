from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from record_views.cards.checks import check_choice
from record_views.cards.config import OnHover
from record_views.cards.view import CardSpec
from record_views.lineage.payload import graph_payload
from record_views.lineage.view import (
    HIGHLIGHT_LINKS,
    ORIENTATIONS,
    Height,
    HighlightLinks,
    OnSelect,
    Orientation,
    StatusDisplay,
    Width,
    build_graph,
    render_lineage,
)
from record_views.link import Link
from record_views.record import Record


def lineage_graph(
    records: Record | Iterable[Record],
    links: Iterable[Link | tuple[Any, ...]] = (),
    *,
    focus: str | None = None,
    depth: int | None = None,
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
    card_config: CardSpec = None,
    on_hover: OnHover = "medium",
    highlight_links: HighlightLinks = "direct",
) -> str | None:
    """Renders records as a layered graph flowing from upstream to downstream.

    Args:
        records: The records to connect, each with a unique id.
        links: The relations between the records: Link objects, or tuples of
            (record_1, record_2), (record_1, record_2, label), or
            (record_1, record_2, label, directed). A directed link leads
            from record_1, upstream, to record_2, downstream.
        focus: The id of a record to center the graph on, or None to show
            every record.
        depth: With focus, the number of hops to show in each direction, or
            None for all.
        orientation: "horizontal" flows left to right, "vertical" flows top
            to bottom, and "auto" picks by the available width.
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
        highlight_links: What hovering or focusing a record highlights, and
            what selecting one keeps highlighted: "direct" for its own links
            and the records they join, "chain" for every link on a path to
            or from it, or None for no highlighting.

    Returns:
        The id of the selected record, or None if nothing is selected.

    Raises:
        TypeError: If links is not an iterable of Link objects or tuples, or
            card_config is not a supported value.
        ValueError: If a record has no id, ids repeat, a link names an id that
            no record has or repeats an earlier link, focus is not one of the
            records, orientation is unsupported, or height, width, on_select,
            status_display, on_hover, or highlight_links is invalid, or
            on_select is a callback without key.
    """
    check_choice("orientation", orientation, ORIENTATIONS)
    check_choice("highlight_links", highlight_links, HIGHLIGHT_LINKS)
    graph = build_graph(records, links)
    if focus is None:
        ids = graph.ids
    else:
        graph.require(focus)
        ids = [
            focus,
            *graph.ancestors(focus, depth),
            *graph.descendants(focus, depth),
            *graph.related(focus),
        ]
        ids = list(dict.fromkeys(ids))
    data = {
        **graph_payload(
            graph,
            ids,
            card_config=card_config,
            on_hover=on_hover,
            status_display=status_display,
        ),
        "layers": graph.layers(ids),
        "focus": focus,
        "orientation": orientation,
        "highlightLinks": highlight_links,
    }
    return render_lineage(
        "lineage_graph",
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
