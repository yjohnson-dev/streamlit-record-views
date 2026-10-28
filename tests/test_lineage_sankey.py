from __future__ import annotations

import pytest

from record_views import EntityRef, Record, lineage_sankey
from record_views.lineage import view

pytestmark = pytest.mark.usefixtures("session")


ATLAS = EntityRef("Example Supply Co", "Supplier", "SUP-01")
NORTH = EntityRef("Warehouse North", "Warehouse", "WH-01")
EAST = EntityRef("DC East", "Distribution Center", "DC-01")
ACME = EntityRef("Acme Industrial", "Customer", "CUST-1")


class FakeComponent:
    """Records the arguments a lineage component receives."""

    def __init__(self, selected: str | None = None):
        self.calls: list[dict] = []
        self.selected = selected

    def __call__(self, **kwargs):
        self.calls.append(kwargs)
        return {"selected": self.selected}


@pytest.fixture
def component(monkeypatch):
    fake = FakeComponent()
    monkeypatch.setattr(view, "lineage_component", lambda name: fake)
    return fake


def flow(record_id, source, target, quantity=None):
    return Record(
        "Transfer",
        record_id,
        id=record_id,
        sources=[source],
        targets=[target],
        fields={"Quantity": quantity} if quantity is not None else {},
    )


CHAIN = [
    flow("GR-1", ATLAS, NORTH, 1200),
    flow("GR-2", ATLAS, NORTH, 300),
    flow("TO-1", NORTH, EAST, 900),
    flow("IF-1", EAST, ACME, 600),
]


def payload(component):
    return component.calls[0]["data"]


def test_entities_carry_their_column(component):
    lineage_sankey(CHAIN, value="Quantity", key="s")
    layers = {e["key"]: e["layer"] for e in payload(component)["entities"]}
    assert layers == {"SUP-01": 0, "WH-01": 1, "DC-01": 2, "CUST-1": 3}


def test_flows_between_the_same_entities_add_up(component):
    lineage_sankey(CHAIN, value="Quantity", key="s")
    flows = {(f["from"], f["to"]): f for f in payload(component)["flows"]}
    first = flows[("SUP-01", "WH-01")]
    assert first["value"] == 1500.0
    assert first["records"] == ["GR-1", "GR-2"]
    assert len(flows) == 3


def test_nodes_are_the_records_behind_the_flows(component):
    lineage_sankey(CHAIN, value="Quantity", key="s")
    data = payload(component)
    assert [n["id"] for n in data["nodes"]] == ["GR-1", "GR-2", "TO-1", "IF-1"]
    assert data["edges"] == []
    assert data["unit"] == "Quantity"


def test_without_a_value_each_record_weighs_one(component):
    lineage_sankey(CHAIN, key="s")
    data = payload(component)
    assert data["unit"] == "Records"
    assert data["flows"][0]["value"] == 2.0


def test_missing_values_add_nothing(component):
    records = [flow("GR-1", ATLAS, NORTH), flow("GR-2", ATLAS, NORTH, 5)]
    lineage_sankey(records, value="Quantity", key="s")
    only = payload(component)["flows"][0]
    assert only["value"] == 5.0
    assert only["records"] == ["GR-1", "GR-2"]


def test_entities_without_identifiers_match_by_name(component):
    records = [
        flow("A", EntityRef("Dock", "Location"), NORTH, 1),
        flow("B", NORTH, EntityRef("Dock", "Location"), 1),
    ]
    lineage_sankey(records, key="s")
    keys = [e["key"] for e in payload(component)["entities"]]
    assert keys == ["Dock", "WH-01"]


def test_a_record_with_several_ends_makes_every_pairing(component):
    record = Record(
        "Transfer",
        "T",
        id="T",
        sources=[ATLAS, NORTH],
        targets=[EAST, ACME],
        fields={"Quantity": 10},
    )
    lineage_sankey([record], value="Quantity", key="s")
    pairs = {(f["from"], f["to"]) for f in payload(component)["flows"]}
    assert pairs == {
        ("SUP-01", "DC-01"),
        ("SUP-01", "CUST-1"),
        ("WH-01", "DC-01"),
        ("WH-01", "CUST-1"),
    }


def test_records_without_both_ends_are_skipped(component):
    records = [
        *CHAIN,
        Record("Note", "N-1", id="N-1", sources=[ATLAS]),
        Record("Note", "N-2", id="N-2", targets=[ATLAS]),
        Record("Note", "N-3", id="N-3"),
    ]
    lineage_sankey(records, value="Quantity", key="s")
    ids = [n["id"] for n in payload(component)["nodes"]]
    assert ids == ["GR-1", "GR-2", "TO-1", "IF-1"]


def test_cycles_get_finite_columns(component):
    records = [flow("OUT", ACME, NORTH, 1), flow("BACK", NORTH, ACME, 1)]
    lineage_sankey(records, key="s")
    layers = {e["key"]: e["layer"] for e in payload(component)["entities"]}
    assert layers == {"CUST-1": 0, "WH-01": 1}
