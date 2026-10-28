from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import Any

from record_views.cards.checks import check_choice
from record_views.lineage.model import LineageGraph
from record_views.cards.config import OnHover
from record_views.cards.view import CardSpec
from record_views.lineage.payload import graph_payload
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


def _tree(
    graph: LineageGraph,
    root: str,
    direction: Direction,
    depth: int | None,
) -> tuple[dict[str, Any], dict[str, None]]:
    """Builds the tree under a root, marking nodes already shown.

    Args:
        graph: The lineage graph.
        root: The id of the node at the top.
        direction: Whether to follow children or parents.
        depth: The number of levels below the root, or None for all.

    Returns:
        The root's tree entry and the ids shown, in display order.
    """
    step = graph.children if direction == "downstream" else graph.parents
    labels = {
        (edge.upstream, edge.downstream): edge.relationship
        for edge in graph.edges
        if not edge.related
    }
    shown: dict[str, None] = {}
    frames: list[tuple[dict[str, Any], Iterator[str], int | None]] = []

    def visit(
        node: str, relationship: str | None, levels: int | None
    ) -> dict[str, Any]:
        entry: dict[str, Any] = {
            "id": node,
            "relationship": relationship,
            "children": [],
            "repeat": node in shown,
            "more": False,
        }
        if entry["repeat"]:
            return entry
        shown[node] = None
        following = step(node)
        if levels == 0:
            entry["more"] = bool(following)
        else:
            frames.append((entry, iter(following), levels))
        return entry

    top = visit(root, None, depth)
    while frames:
        entry, following, levels = frames[-1]
        child = next(following, None)
        if child is None:
            frames.pop()
            continue
        edge = (
            (entry["id"], child)
            if direction == "downstream"
            else (child, entry["id"])
        )
        entry["children"].append(
            visit(
                child,
                labels.get(edge),
                None if levels is None else levels - 1,
            )
        )
    return top, shown


def lineage_tree(
    records: Record | Iterable[Record],
    links: Iterable[Link | tuple[Any, ...]] = (),
    *,
    root: str,
    direction: Direction = "downstream",
    depth: int | None = None,
    expanded: int = 2,
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
    """Renders a collapsible tree of the records downstream or upstream of one.

    Args:
        records: The records to connect, each with a unique id.
        links: The relations between the records: Link objects, or tuples of
            (record_1, record_2), (record_1, record_2, label), or
            (record_1, record_2, label, directed). A directed link leads
            from record_1, upstream, to record_2, downstream.
        root: The id of the record at the top of the tree.
        direction: "downstream" shows where the root went, such as a lot's
            shipments; "upstream" shows where it came from, such as a
            product's components.
        depth: The number of levels to include below the root: 0 for only
            the root, 1 for its direct links, or None for all. A record with
            more levels beyond the limit is marked.
        expanded: The number of levels open when the tree first renders: 0
            shows only the root, 1 also its direct links, and so on.
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
            no record has or repeats an earlier link, root is not one of the
            records, direction is unsupported, depth or expanded is negative,
            or height, width, on_select, status_display, or on_hover is
            invalid, or on_select is a callback without key.
    """
    check_choice("direction", direction, DIRECTIONS)
    if depth is not None and depth < 0:
        raise ValueError(f"depth must be at least 0, not {depth}.")
    if expanded < 0:
        raise ValueError(f"expanded must be at least 0, not {expanded}.")
    graph = build_graph(records, links)
    graph.require(root)
    tree, shown = _tree(graph, root, direction, depth)
    data = {
        **graph_payload(
            graph,
            shown,
            card_config=card_config,
            on_hover=on_hover,
            status_display=status_display,
        ),
        "tree": tree,
        "direction": direction,
        "expanded": expanded,
    }
    return render_lineage(
        "lineage_tree",
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
