from __future__ import annotations

from collections.abc import Callable
from dataclasses import KW_ONLY, dataclass
from typing import Any

from record_views.cards.checks import check_choice, check_width
from record_views.cards.config import (
    CARD_SIZES,
    HOVER_SIZES,
    ON_HOVER,
    CardSize,
    OnHover,
    Width,
)
from record_views.cards.view import (
    CardConfig,
    CardSpec,
    render_view,
    resolve_config,
    view_payload,
)
from record_views.record import Record


@dataclass(frozen=True)
class CardView:
    """Defines a card: the record, how it looks, its size, and its hover.

    A CardView only describes the card. card() renders it.

    Attributes:
        record: The record metadata and fields to display.
        card_config: How the record looks: a card_config.RecordCard,
            TileCard, PropertyCard, or LedgerCard object; one of the names
            "record", "tile", "property", and "ledger", which mean that class
            with its defaults; or None for RecordCard(). Kept as the
            configuration object.
        size: Presentation size: "compact", "small", "medium", or "large".
            "compact" is a fixed card that does not adapt to its width;
            lineage components draw records with it.
        on_hover: What hovering or focusing the card shows above the page.
            None shows the same card in full when its content is cut off,
            and nothing otherwise. "small", "medium", or "large" always shows
            the same card at that size. A CardView always shows that card,
            which can have its own record, configuration, and size. "disabled"
            shows nothing.

    Raises:
        TypeError: If card_config is not a supported value.
        ValueError: If size or on_hover is not a supported value, or on_hover
            is a CardView whose size is "compact" or whose own on_hover is not
            None.
    """

    record: Record
    card_config: CardSpec = None
    _: KW_ONLY
    size: CardSize = "medium"
    on_hover: OnHover | CardView = None

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "card_config", resolve_config(self.card_config)
        )
        check_choice("size", self.size, CARD_SIZES)
        hover = self.on_hover
        if not isinstance(hover, CardView):
            check_choice("on_hover", hover, ON_HOVER)
        elif hover.size not in HOVER_SIZES:
            raise ValueError(
                f"A hover CardView's size must be one of {HOVER_SIZES}."
            )
        elif hover.on_hover is not None:
            raise ValueError("A hover CardView cannot have its own on_hover.")


def _drawn(
    config: CardConfig, record: Record, size: CardSize, disabled: bool
) -> dict[str, Any]:
    """Builds the payload of one card, with the variant that draws it."""
    payload = view_payload(config, record, size, disabled=disabled)
    payload["variant"] = config.variant
    return payload


def card(
    view: CardView,
    *,
    key: str | None = None,
    width: Width = "stretch",
    on_click: Callable[..., Any] | None = None,
    args: tuple[Any, ...] | None = None,
    kwargs: dict[str, Any] | None = None,
    disabled: bool = False,
    help: str | None = None,
) -> bool:
    """Renders a card.

    Args:
        view: The card to render: its record, configuration, size, and what
            hovering it shows.
        key: A unique component key. Defaults to one derived from the card
            type and the record's id, and is required when the record has no
            id.
        width: "stretch" to fill the container, "content" to fit the card's
            content, or a width in pixels.
        on_click: Callback executed when the card is clicked.
        args: Positional arguments passed to on_click.
        kwargs: Keyword arguments passed to on_click.
        disabled: When True, renders the card, and its hover card, in an
            inactive non-interactive state.
        help: Plain text shown in a tooltip when hovering or focusing the
            card. Newlines are preserved.

    Returns:
        True if the card was clicked in the current script run, False otherwise.

    Raises:
        TypeError: If view is not a CardView.
        ValueError: If width is not a supported value, or key is omitted for
            a record without an id.
    """
    if not isinstance(view, CardView):
        raise TypeError(
            f"view must be a CardView, such as CardView(record), not {view!r}."
        )
    config, record = view.card_config, view.record
    check_width(width)
    if key is None:
        if record.id is None:
            raise ValueError("key is required when the record has no id.")
        key = f"card-{config.variant}:{record.id}"

    hover = view.on_hover
    if isinstance(hover, CardView):
        # A hover card always shows, as a hover size does.
        mode = hover.size
        shown = _drawn(hover.card_config, hover.record, hover.size, disabled)
    else:
        mode = hover
        shown = (
            _drawn(config, record, hover, disabled)
            if hover in HOVER_SIZES
            else None
        )
    payload = _drawn(config, record, view.size, disabled)
    payload.update(
        help=help,
        contentWidth=width == "content",
        onHover=mode,
        hover=shown,
    )
    return render_view(
        payload,
        key=key,
        width=width,
        on_click=on_click,
        args=args,
        kwargs=kwargs,
    )
