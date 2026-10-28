from __future__ import annotations


import pytest

from record_views import (
    Link,
    Record,
)
from record_views.lineage import view
from record_views.lineage.model import LineageEdge, LineageGraph

pytestmark = pytest.mark.usefixtures("session")


def rec(record_id, record_type="Doc", **extra):
    return Record(record_type, record_id, id=record_id, **extra)


def down(upstream, downstream, label="then"):
    return Link(upstream, downstream, label)


def related(first, second, label="see also"):
    return Link(first, second, label, directed=False)


def ids(*names):
    return [rec(name) for name in names]


class FakeComponent:
    """Records the arguments a lineage component receives."""

    def __init__(self, selected=None):
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


def test_undirected_links_are_related_edges_with_sorted_ids():
    for link in (related("A", "B"), related("B", "A")):
        graph = LineageGraph(ids("B", "A"), [link])
        assert graph.edges == (LineageEdge("A", "B", "see also", related=True),)
        assert graph.related("A") == ["B"]
        assert graph.related("B") == ["A"]
        assert graph.children("A") == []


def test_a_link_to_an_unknown_record_names_the_link_and_the_id():
    with pytest.raises(ValueError) as error:
        LineageGraph(ids("A"), [down("A", "X", "billed on")])
    message = str(error.value)
    assert "billed on" in message
    assert "'A'" in message
    assert "'X'" in message
    assert "which no record has" in message
    with pytest.raises(ValueError, match="'Y'"):
        LineageGraph(ids("A"), [down("Y", "A")])


def test_the_same_directed_link_twice_is_rejected():
    with pytest.raises(ValueError, match="repeats an earlier link"):
        LineageGraph(ids("A", "B"), [down("A", "B"), down("A", "B", "other")])


def test_the_same_undirected_link_twice_is_rejected_in_either_order():
    with pytest.raises(ValueError, match="repeats an earlier link"):
        LineageGraph(ids("A", "B"), [related("A", "B"), related("B", "A")])


def test_opposite_directed_links_make_a_cycle():
    graph = LineageGraph(
        ids("A", "B"), [down("A", "B", "x"), down("B", "A", "y")]
    )
    assert graph.edges == (
        LineageEdge("A", "B", "x"),
        LineageEdge("B", "A", "y"),
    )
    assert graph.descendants("A") == ["B"]
    assert graph.levels() == {"A": 0, "B": 1}


def test_a_directed_link_wins_over_an_undirected_one_on_the_same_pair():
    for links in (
        [related("A", "B", "near"), down("B", "A", "feeds")],
        [down("B", "A", "feeds"), related("A", "B", "near")],
    ):
        graph = LineageGraph(ids("A", "B"), links)
        assert len(graph.edges) == 2
        assert graph.edge("A", "B") == LineageEdge("B", "A", "feeds")


def test_walks_and_paths():
    graph = LineageGraph(
        ids("A", "B", "C", "D"),
        [down("A", "B"), down("B", "C"), down("B", "D")],
    )
    assert graph.descendants("A") == ["B", "C", "D"]
    assert graph.descendants("A", depth=1) == ["B"]
    assert graph.ancestors("D") == ["B", "A"]
    assert graph.path_to("D") == ["A", "B", "D"]
    assert graph.path_from("A") == ["A", "B"]
    assert graph.edge("C", "B") == LineageEdge("B", "C", "then")


def test_levels_ignore_cycles_and_place_related_roots():
    graph = LineageGraph(
        ids("A", "B", "C", "D"),
        [down("A", "B"), down("B", "C"), down("C", "A"), related("C", "D")],
    )
    level = graph.levels()
    assert level["A"] == 0 and level["B"] == 1 and level["C"] == 2
    assert level["D"] == 2


def test_layers_use_longest_paths_and_reduce_crossings():
    graph = LineageGraph(
        ids("A", "B", "C", "D", "E", "S"),
        [down("A", "C"), down("B", "D"), down("D", "E"), down("S", "E")],
    )
    layers = graph.layers()
    assert layers[0] == ["A", "B", "S"]
    assert layers[1] == ["C", "D"]
    assert layers[2] == ["E"]


def test_sequence_orders_by_links_and_keeps_input_ties():
    graph = LineageGraph(
        ids("C", "B", "A", "Z"), [down("B", "C"), down("A", "B")]
    )
    assert graph.sequence() == ["A", "Z", "B", "C"]


CHAIN = ids("A", "B", "C", "D")
CHAIN_LINKS = [down("A", "B"), down("B", "C"), down("C", "D")]


def test_levels_handle_long_chains():
    names = [f"N{i}" for i in range(3000)]
    links = [down(names[i - 1], names[i]) for i in range(1, 3000)]
    level = LineageGraph(ids(*names), links).levels()
    assert level["N2999"] == 2999


def test_related_roots_sit_beside_their_related_node():
    graph = LineageGraph(
        ids("A", "B", "R", "C"),
        [down("A", "B"), related("B", "R", "returned on"), down("R", "C")],
    )
    assert graph.levels() == {"A": 0, "B": 1, "R": 1, "C": 2}


def test_related_roots_follow_their_related_node_in_a_layer():
    graph = LineageGraph(
        ids("A", "B", "C", "D", "R"),
        [
            down("A", "B"),
            down("A", "C"),
            down("A", "D"),
            related("B", "R", "returned on"),
        ],
    )
    assert graph.layers() == [["A"], ["B", "R", "C", "D"]]
