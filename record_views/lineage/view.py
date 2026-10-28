from __future__ import annotations

import functools
from collections.abc import Callable, Iterable, Mapping
from typing import Any, Literal, get_args

import streamlit as st

from record_views.cards.checks import check_choice, check_width
from record_views.cards.config import STATUS_DISPLAYS, StatusDisplay, Width
from record_views.lineage.model import LineageGraph
from record_views.link import Link, coerce_links
from record_views.record import Record

Height = Literal["content"] | int
Orientation = Literal["auto", "horizontal", "vertical"]
Direction = Literal["downstream", "upstream"]
HighlightMode = Literal["direct", "chain"]
HighlightLinks = HighlightMode | None
ORIENTATIONS = get_args(Orientation)
HIGHLIGHT_LINKS = (*get_args(HighlightMode), None)
DIRECTIONS = get_args(Direction)
OnSelect = Literal["rerun", "ignore"] | Callable[..., Any]

_SELECTIONS = "record_views.selections"


@functools.cache
def lineage_component(name: str) -> Callable[..., Any]:
    """Registers a lineage component's CCv2 component on first use.

    Args:
        name: The component name, such as "lineage_strip", matching its build
            assets and its pyproject.toml declaration.

    Returns:
        The component callable.
    """
    return st.components.v2.component(
        f"streamlit-record-views.{name}",
        js=f"{name}-*.js",
        css=f"{name}-*.css",
        html='<div class="lineage-root"></div>',
    )


def build_graph(
    records: Record | Iterable[Record],
    links: Iterable[Link | tuple[Any, ...]] | None,
) -> LineageGraph:
    """Builds a lineage graph from one record or many, and their links.

    Args:
        records: A record, or an iterable of records with unique ids.
        links: Link objects or tuples, or None for no links.

    Returns:
        The lineage graph.

    Raises:
        TypeError: If links is not an iterable of Link objects or tuples.
        ValueError: If a record has no id, two records share an id, or a link
            names an id that no record has or repeats an earlier link.
    """
    if isinstance(records, Record):
        records = [records]
    return LineageGraph(records, coerce_links(links))


def _selection(result: Any) -> str | None:
    """Reads the selected id from a component result."""
    if isinstance(result, dict):
        return result.get("selected")
    return getattr(result, "selected", None)


def render_lineage(
    name: str,
    data: Mapping[str, Any],
    *,
    key: str | None,
    label: str | None = None,
    selected: str | None,
    on_select: OnSelect,
    args: tuple[Any, ...] | None,
    kwargs: dict[str, Any] | None,
    height: Height,
    width: Width = "stretch",
    border: bool = False,
    background: bool = False,
    status_display: StatusDisplay = "full",
    component: Callable[..., Any] | None = None,
) -> str | None:
    """Mounts a lineage component and returns the selected record id.

    Args:
        name: The component name, such as "lineage_strip".
        data: The component payload.
        key: A unique component key, or None to let Streamlit derive one.
        label: Text shown above the component, or None for none.
            Required when on_select is a callback.
        selected: The selected id. With a key, a new value replaces the
            user's selection, and None clears it.
        on_select: "rerun" to rerun the script when the user changes the
            selection, a callback called with the selected id (or None)
            before that rerun, or "ignore" to show records without
            selection.
        args: Positional arguments passed to on_select after the id.
        kwargs: Keyword arguments passed to on_select.
        height: "content" to fit the content, or a height in pixels that
            scrolls when the content is taller.
        width: "stretch" to fill the container, "content" to fit the
            content, or a width in pixels.
        border: Whether to frame the component with a border, as
            st.container(border=True) does.
        background: Whether to fill the component with the secondary
            background color.
        status_display: "full" for each record's status dot and text, with
            the text dropped where it does not fit; "dot" for only the dot;
            or None to omit statuses.
        component: The component callable to render with; defaults to the
            registered component for name.

    Returns:
        The id of the selected record, or None if nothing is selected.

    Raises:
        ValueError: If height is neither "content" nor a positive integer,
            width is not "stretch", "content", or a positive integer,
            on_select is neither "rerun", "ignore", nor a callable, or is a
            callable without key, or status_display is not "full", "dot",
            or None.
    """
    check_width(width)
    check_choice("status_display", status_display, STATUS_DISPLAYS)
    if not callable(on_select) and on_select not in ("rerun", "ignore"):
        raise ValueError(
            'on_select must be "rerun", "ignore", or a callable, '
            f"not {on_select!r}."
        )
    if callable(on_select) and key is None:
        raise ValueError("on_select needs key when it is a callback.")
    if height != "content" and (
        isinstance(height, bool) or not isinstance(height, int) or height <= 0
    ):
        raise ValueError(
            f'height must be "content" or a positive integer, not {height!r}.'
        )

    track = None
    if key is not None:
        tracked = st.session_state.setdefault(_SELECTIONS, {})
        track = tracked.setdefault(
            key, {"selected": selected, "revision": 0, "syncing": False}
        )
    replaced = track is not None and selected != track["selected"]
    if replaced:
        track.update(selected=selected, revision=track["revision"] + 1)

    def _changed() -> None:
        value = _selection(st.session_state.get(key))
        if track is not None and track["syncing"]:
            track["syncing"] = False
            if value == track["selected"]:
                return
        if callable(on_select):
            on_select(value, *(args or ()), **(kwargs or {}))

    result = (component or lineage_component(name))(
        key=key,
        data={
            **data,
            "selected": selected,
            "revision": track["revision"] if track else 0,
            "selectable": on_select != "ignore",
            "contentWidth": width == "content",
            "border": border,
            "background": background,
            "statusDisplay": status_display,
            "label": label,
        },
        default={"selected": selected},
        on_selected_change=_changed,
        width=width,
        height=height,
    )
    current = _selection(result)
    if replaced:
        # The frontend echoes a replaced selection in a later run.
        track["syncing"] = current != selected
    if track is not None and track["syncing"]:
        return track["selected"]
    return current
