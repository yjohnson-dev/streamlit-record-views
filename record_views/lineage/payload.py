from __future__ import annotations

from collections.abc import Iterable
from dataclasses import replace
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from record_views.card_config import RecordCard
from record_views.cards.checks import check_choice
from record_views.cards.config import (
    HOVER_SIZES,
    ON_HOVER,
    OnHover,
    StatusDisplay,
)
from record_views.cards.payload import ABSENT, field_value
from record_views.cards.view import (
    CardConfig,
    CardSpec,
    resolve_config,
    view_payload,
)
from record_views.lineage.model import LineageEdge, LineageGraph
from record_views.record import EntityRef, Record


def field_number(record: Record, label: str) -> float | None:
    """Returns a record's numeric field value by label.

    Returns:
        The value as a float, or None if the record has no such field or
        its value is None.

    Raises:
        ValueError: If the value is present but not a number.
    """
    for field in record.fields:
        if field.label == label:
            value = field.value
            if value is None:
                return None
            if isinstance(value, (int, float, Decimal)) and not isinstance(
                value, bool
            ):
                return float(value)
            raise ValueError(
                f"Field {label!r} of record {record.id!r} must be a number, "
                f"not {value!r}."
            )
    return None


def entity_payload(entity: EntityRef) -> dict[str, Any]:
    """Serializes an entity reference.

    Returns:
        A mapping with "key", "name", "type", and "identifier" entries. The
        key is the identifier, or the name when there is none.
    """
    return {
        "key": entity.identifier or entity.name,
        "name": entity.name,
        "type": entity.entity_type,
        "identifier": entity.identifier,
    }


def styled_config(
    card_config: CardSpec, status_display: StatusDisplay = "full"
) -> CardConfig:
    """Resolves a card configuration and applies the component's status.

    Args:
        card_config: A configuration object, a configuration name, or None.
        status_display: The component's status display. A configuration with
            its own status_display wins.

    Returns:
        The configuration that draws every record.

    Raises:
        TypeError: If card_config is not a supported value.
    """
    config = resolve_config(card_config)
    if config.status_display == "full" and status_display != "full":
        return replace(config, status_display=status_display)
    return config


def focus_payload(
    record: Record,
    card_config: CardSpec = None,
    status_display: StatusDisplay = "full",
) -> dict[str, Any]:
    """Serializes a record as a medium card for embedding.

    Args:
        record: The record to draw.
        card_config: A configuration object, a configuration name, or None
            for RecordCard().
        status_display: The component's status display.

    Returns:
        A payload conforming to the frontend ViewData interface.
    """
    config = styled_config(card_config, status_display)
    return view_payload(config, record, "medium", disabled=True)


def iso_timestamp(record: Record) -> str | None:
    """Returns a record's timestamp in ISO 8601 form for ordering.

    Returns:
        The ISO string for a date or datetime timestamp, or None for a
        missing or free-text timestamp.
    """
    if isinstance(record.timestamp, (date, datetime)):
        return record.timestamp.isoformat()
    return None


def node_payload(
    record: Record,
    config: CardConfig | None = None,
    on_hover: OnHover = "medium",
    *,
    all_fields: bool = False,
) -> dict[str, Any]:
    """Serializes a record as a lineage node.

    Args:
        record: The record to serialize.
        config: How the record looks, or None for RecordCard().
        on_hover: The size of the card the node shows on hover, or None or
            "disabled" for no hover payload.
        all_fields: Whether to list every field in the node, for components
            that read field values.

    Returns:
        The record's compact card payload, as card() receives it for a
        compact CardView, plus the id, origin, and ISO timestamp. A "hover"
        entry holds the payload of the card at the on_hover size, or None.
        Conforms to the frontend LineageNode.
    """
    config = config or RecordCard()
    payload = view_payload(config, record, "compact")
    if all_fields:
        payload["fields"] = [
            [field.label, field_value(field.value)] for field in record.fields
        ]
    payload.update(
        id=record.id,
        origin=record.origin,
        iso=iso_timestamp(record),
        hover=(
            view_payload(config, record, on_hover, disabled=True)
            if on_hover in HOVER_SIZES
            else None
        ),
    )
    return payload


def edge_payload(edge: LineageEdge) -> dict[str, Any]:
    """Serializes an edge.

    Returns:
        A JSON-serializable edge conforming to the frontend LineageEdge.
    """
    return {
        "from": edge.upstream,
        "to": edge.downstream,
        "relationship": edge.relationship,
        "related": edge.related,
    }


def graph_payload(
    graph: LineageGraph,
    ids: Iterable[str],
    *,
    card_config: CardSpec = None,
    on_hover: OnHover = "medium",
    status_display: StatusDisplay = "full",
    all_fields: bool = False,
) -> dict[str, Any]:
    """Serializes a set of nodes and the edges among them.

    Args:
        graph: The lineage graph.
        ids: The node ids to include.
        card_config: A configuration object, a configuration name, or None
            for the component's own choice of card.
        on_hover: "small", "medium", or "large" for the card size each node
            shows on hover; None for the compact card in full when it is cut
            off; or "disabled" for nothing.
        status_display: The component's status display. A configuration with
            its own status_display wins.
        all_fields: Whether to list every field in each node.

    Returns:
        A mapping with "nodes", "edges", "absent", "cardVariant", and
        "onHover" entries. The variant is None without a card_config.

    Raises:
        TypeError: If card_config is not a supported value.
        ValueError: If on_hover is not a supported value.
    """
    check_choice("on_hover", on_hover, ON_HOVER)
    config = styled_config(card_config, status_display)
    members = list(dict.fromkeys(ids))
    return {
        "nodes": [
            node_payload(
                graph.record(node), config, on_hover, all_fields=all_fields
            )
            for node in members
        ],
        "edges": [edge_payload(edge) for edge in graph.edges_within(members)],
        "absent": ABSENT,
        "cardVariant": None if card_config is None else config.variant,
        "onHover": on_hover,
    }
