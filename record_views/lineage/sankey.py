from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from record_views.lineage.payload import (
    entity_payload,
    field_number,
    graph_payload,
)
from record_views.lineage.view import (
    Height,
    OnSelect,
    StatusDisplay,
    Width,
    build_graph,
    render_lineage,
)
from record_views.record import Record


def _entity_layers(
    keys: list[str], flows: list[dict[str, Any]]
) -> dict[str, int]:
    """Assigns entities to columns by their longest upstream flow path.

    Args:
        keys: The entity keys.
        flows: The flows, each with "from" and "to" entity keys. Flows that
            close a cycle are ignored.

    Returns:
        The column of each key, starting at 0 for entities nothing flows to.
    """
    following: dict[str, list[str]] = {key: [] for key in keys}
    for flow in flows:
        following[flow["from"]].append(flow["to"])
    layer = dict.fromkeys(keys, 0)
    state: dict[str, int] = {}
    order: list[str] = []
    cycles: set[tuple[str, str]] = set()

    def visit(node: str) -> None:
        state[node] = 1
        for child in following[node]:
            if state.get(child) == 1:
                cycles.add((node, child))
            elif child not in state:
                visit(child)
        state[node] = 2
        order.append(node)

    for key in keys:
        if key not in state:
            visit(key)
    for node in reversed(order):
        for child in following[node]:
            if (node, child) not in cycles:
                layer[child] = max(layer[child], layer[node] + 1)
    return layer


def lineage_sankey(
    records: Record | Iterable[Record],
    *,
    value: str | None = None,
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
    """Renders flows between entities, weighted by a numeric field.

    Args:
        records: The records, each with a unique id. Each record with sources
            and targets is a flow from every source entity to every target
            entity, such as a receipt from a supplier to a warehouse, and
            adds its full value to each of those flows. Entities with an
            identifier match by identifier and the rest by name, so a
            warehouse that receives and ships goods joins both flows.
            Records without both sources and targets are skipped.
        value: The label of a numeric field that weights each flow, such as
            "Quantity". None weights every record as 1. A record without the
            field, or with the value None, adds nothing.
        label: Text shown above the component, or None for none.
        key: A unique component key. Provide one to keep the selection when
            the records change, to set the selection from code, or to use
            an on_select callback.
        selected: The selected entity key. With a key, a new value replaces
            the user's selection, and None clears it.
        on_select: "rerun" to rerun the script when the user changes the
            selection, a callback called with the selected id (or None)
            before that rerun, or "ignore" to show entities without
            selection.
        args: Positional arguments passed to on_select after the id.
        kwargs: Keyword arguments passed to on_select.
        height: "content" to fit the content, or a height in pixels.
        width: "stretch" to fill the container, "content" to fit the
            content, or a width in pixels.
        border: Whether to frame the diagram with a border, as
            st.container(border=True) does.
        background: Whether to fill the diagram with the secondary
            background color.
        status_display: "full" for each record's status dot and text, with
            the text dropped where it does not fit; "dot" for only the dot;
            or None to omit statuses.

    Returns:
        The key of the selected entity (its identifier, or its name when it
        has none), or None if nothing is selected.

    Raises:
        ValueError: If a value field holds text, a record has no id, ids repeat,
            or height, width, on_select, or status_display is invalid, or
            on_select is a callback without key.
    """
    graph = build_graph(records, ())
    entities: dict[str, dict[str, Any]] = {}
    flows: dict[tuple[str, str], dict[str, Any]] = {}
    for node in graph.ids:
        record = graph.record(node)
        if not record.sources or not record.targets:
            continue
        weight = 1.0 if value is None else (field_number(record, value) or 0.0)
        for source in record.sources:
            for target in record.targets:
                start = entity_payload(source)
                end = entity_payload(target)
                entities.setdefault(start["key"], start)
                entities.setdefault(end["key"], end)
                flow = flows.setdefault(
                    (start["key"], end["key"]),
                    {
                        "from": start["key"],
                        "to": end["key"],
                        "value": 0.0,
                        "records": [],
                    },
                )
                flow["value"] += weight
                flow["records"].append(node)
    flow_list = list(flows.values())
    layer = _entity_layers(list(entities), flow_list)
    for entity_key, entity in entities.items():
        entity["layer"] = layer[entity_key]
    record_ids = [
        record_id for flow in flow_list for record_id in flow["records"]
    ]
    data = {
        **graph_payload(
            graph,
            record_ids,
            status_display=status_display,
            all_fields=True,
        ),
        "edges": [],
        "entities": list(entities.values()),
        "flows": flow_list,
        "unit": value or "Records",
    }
    return render_lineage(
        "lineage_sankey",
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
