from __future__ import annotations

from typing import Literal, get_args

CardSize = Literal["compact", "small", "medium", "large"]
HeaderSlot = Literal["status", "caption"] | None
StatusDisplay = Literal["full", "dot"] | None
Width = Literal["stretch", "content"] | int
OnHover = Literal["small", "medium", "large", "disabled"] | None
CARD_SIZES = get_args(CardSize)
HEADER_SLOTS = ("status", "caption", None)
STATUS_DISPLAYS = ("full", "dot", None)
HOVER_SIZES = ("small", "medium", "large")
ON_HOVER = (*HOVER_SIZES, "disabled", None)
HIDEABLE = frozenset({"status", "subtitle", "caption", "note"})
