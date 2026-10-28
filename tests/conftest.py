from __future__ import annotations

from types import SimpleNamespace

import pytest

from record_views import Link, Record
from record_views.cards import view as card_view
from record_views.lineage import view


@pytest.fixture
def session(monkeypatch):
    state: dict = {}
    monkeypatch.setattr(view, "st", SimpleNamespace(session_state=state))
    return state


class Frontend:
    """Stands in for a CCv2 component and keeps what Python sent it."""

    def __init__(self):
        self.calls: list[dict] = []
        self.names: list[str] = []
        self.reply: dict = {}

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        return self.reply

    def register(self, name):
        self.names.append(name)
        return self

    @property
    def data(self) -> dict:
        return self.calls[-1]["data"]


@pytest.fixture
def lineage(monkeypatch, session):
    frontend = Frontend()
    frontend.reply = {"selected": None}
    monkeypatch.setattr(view, "lineage_component", frontend.register)
    return frontend


@pytest.fixture
def cards(monkeypatch):
    frontend = Frontend()
    frontend.reply = {"click": False}
    monkeypatch.setattr(
        card_view, "card_component", lambda: frontend.register("card")
    )
    return frontend


@pytest.fixture
def crafting():
    """A game's crafting chain: ore and coal become an ingot, then a sword.

    A smith is related to the sword without being upstream or downstream.
    """
    records = [
        Record("Material", "Iron Ore", id="ore", fields={"Stack": 64}),
        Record("Material", "Coal", id="coal", fields={"Stack": 32}),
        Record(
            "Item",
            "Iron Ingot",
            id="ingot",
            status="Common",
            fields={"Stack": 16},
        ),
        Record(
            "Item", "Sword", id="sword", status="Rare", fields={"Damage": 7}
        ),
        Record(
            "Item",
            "Hero Sword",
            id="hero",
            status="Epic",
            fields={"Damage": 12},
        ),
        Record("NPC", "Blacksmith", id="smith"),
    ]
    links = [
        Link("ore", "ingot", "smelted"),
        Link("coal", "ingot", "fuels"),
        Link("ingot", "sword", "forged"),
        Link("sword", "hero", "upgraded"),
        Link("smith", "sword", "crafts", directed=False),
    ]
    return records, links
