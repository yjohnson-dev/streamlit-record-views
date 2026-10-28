"""The lineage components, driven through their public functions."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from record_views import (
    Link,
    Record,
    card_config,
    lineage_flow,
    lineage_graph,
    lineage_sankey,
    lineage_split,
    lineage_steps,
    lineage_strip,
    lineage_timeline,
    lineage_trail,
    lineage_tree,
)


def edge_set(data):
    return {
        (e["from"], e["to"], e["relationship"], e["related"])
        for e in data["edges"]
    }


def test_graph_places_every_record_and_keeps_link_direction(lineage, crafting):
    records, links = crafting
    lineage_graph(records, links)
    data = lineage.data
    assert data["layers"] == [
        ["ore", "coal"],
        ["ingot"],
        ["sword", "smith"],
        ["hero"],
    ]
    assert edge_set(data) == {
        ("ore", "ingot", "smelted", False),
        ("coal", "ingot", "fuels", False),
        ("ingot", "sword", "forged", False),
        ("sword", "hero", "upgraded", False),
        ("smith", "sword", "crafts", True),
    }
    assert {n["id"]: n["status"] for n in data["nodes"]}["hero"] == "Epic"


def test_graph_focus_keeps_the_ancestors_and_descendants(lineage, crafting):
    records, links = crafting
    lineage_graph(records, links, focus="ingot")
    data = lineage.data
    assert data["focus"] == "ingot"
    assert {n["id"] for n in data["nodes"]} == {
        "ore",
        "coal",
        "ingot",
        "sword",
        "hero",
    }
    assert data["layers"] == [["ore", "coal"], ["ingot"], ["sword"], ["hero"]]

    lineage_graph(records, links, focus="ingot", depth=1)
    assert {n["id"] for n in lineage.data["nodes"]} == {
        "ore",
        "coal",
        "ingot",
        "sword",
    }


def test_flow_groups_records_into_stages_and_traces_the_focus(
    lineage, crafting
):
    records, links = crafting
    lineage_flow(records, links)
    data = lineage.data
    assert [(s["name"], s["ids"]) for s in data["stages"]] == [
        ("Material", ["ore", "coal"]),
        ("Item", ["ingot", "sword", "hero"]),
        ("NPC", ["smith"]),
    ]
    assert data["path"] == []

    lineage_flow(records, links, focus="ingot", stages=["NPC"])
    data = lineage.data
    assert [s["name"] for s in data["stages"]] == ["NPC", "Material", "Item"]
    assert data["path"][0] == "ingot"
    assert sorted(data["path"]) == ["coal", "hero", "ingot", "ore", "sword"]


def test_trail_follows_one_path_to_the_focus(lineage, crafting):
    records, links = crafting
    lineage_trail(records, links, focus="hero")
    data = lineage.data
    assert data["trail"] == ["ore", "ingot", "sword", "hero"]
    assert edge_set(data) == {
        ("ore", "ingot", "smelted", False),
        ("ingot", "sword", "forged", False),
        ("sword", "hero", "upgraded", False),
    }


def test_strip_sorts_neighbors_around_the_focus(lineage, crafting):
    records, links = crafting
    lineage_strip(records, links, focus="sword")
    data = lineage.data
    assert (data["upstream"], data["downstream"], data["related"]) == (
        [["ingot"]],
        [["hero"]],
        ["smith"],
    )
    assert data["focusCard"]["title"] == [None, "Sword"]
    assert data["focusCard"]["fields"] == [["Damage", 7]]

    lineage_strip(records, links, focus="sword", enlarge_focused_record=False)
    assert lineage.data["focusCard"] is None


def test_tree_nests_by_link_and_marks_repeats_and_depth(lineage):
    ids = "ABCDE"
    records = [Record("Lot", name, id=name) for name in ids]
    links = [
        Link("A", "B", "split to"),
        Link("A", "C", "split to"),
        Link("B", "D", "merged into"),
        Link("C", "D", "merged into"),
        Link("D", "E", "shipped on"),
    ]

    def shape(entry):
        return (
            entry["id"],
            entry["relationship"],
            entry["repeat"],
            entry["more"],
            [shape(child) for child in entry["children"]],
        )

    lineage_tree(records, links, root="A")
    data = lineage.data
    assert shape(data["tree"]) == (
        "A",
        None,
        False,
        False,
        [
            (
                "B",
                "split to",
                False,
                False,
                [
                    (
                        "D",
                        "merged into",
                        False,
                        False,
                        [("E", "shipped on", False, False, [])],
                    )
                ],
            ),
            (
                "C",
                "split to",
                False,
                False,
                [("D", "merged into", True, False, [])],
            ),
        ],
    )
    assert [n["id"] for n in data["nodes"]] == ["A", "B", "D", "E", "C"]

    lineage_tree(records, links, root="A", depth=1)
    assert [(c["id"], c["more"]) for c in lineage.data["tree"]["children"]] == [
        ("B", True),
        ("C", True),
    ]

    lineage_tree(records, links, root="D", direction="upstream")
    assert shape(lineage.data["tree"])[0] == "D"
    assert [c["id"] for c in lineage.data["tree"]["children"]] == ["B", "C"]


def test_a_long_chain_builds_without_recursion(lineage):
    count = 2000
    records = [Record("Lot", f"C{i}", id=f"C{i}") for i in range(count)]
    links = [Link(f"C{i}", f"C{i + 1}", "next") for i in range(count - 1)]
    lineage_tree(records, links, root="C0", expanded=count)
    entry, levels = lineage.data["tree"], 1
    while entry["children"]:
        (entry,) = entry["children"]
        levels += 1
    assert levels == count


def test_steps_follow_the_links_and_mark_progress(lineage):
    steps = [Record("Step", f"S{i}", id=f"S{i}") for i in (4, 3, 2, 1)]
    links = [Link("S1", "S2", "then"), Link("S2", "S3"), Link("S3", "S4")]

    lineage_steps(steps, links, current="S3")
    data = lineage.data
    assert data["steps"] == ["S1", "S2", "S3", "S4"]
    assert data["states"] == {
        "S1": "done",
        "S2": "done",
        "S3": "current",
        "S4": "upcoming",
    }

    lineage_steps(steps, links, current="S2", order="input")
    data = lineage.data
    assert data["steps"] == ["S4", "S3", "S2", "S1"]
    assert data["states"] == {
        "S4": "done",
        "S3": "done",
        "S2": "current",
        "S1": "upcoming",
    }

    lineage_steps(steps, links)
    assert set(lineage.data["states"].values()) == {"default"}


def test_timeline_orders_by_time_and_puts_undated_records_last(lineage):
    def record(name, stamp=None):
        return Record("Event", name, id=name, timestamp=stamp)

    events = [
        record("late", datetime(2026, 10, 9, 15, 0)),
        record("none"),
        record("early", datetime(2026, 10, 9, 9, 15)),
        record("day", date(2026, 10, 10)),
        record("text", "Q3 2026"),
        record("dated", date(2026, 10, 9)),
    ]
    lineage_timeline(events, [Link("early", "late", "then")])
    data = lineage.data
    assert data["items"] == ["day", "late", "early", "dated", "none", "text"]
    assert edge_set(data) == {("early", "late", "then", False)}
    assert {n["id"]: n["iso"] for n in data["nodes"]} == {
        "day": "2026-10-10",
        "late": "2026-10-09T15:00:00",
        "early": "2026-10-09T09:15:00",
        "dated": "2026-10-09",
        "none": None,
        "text": None,
    }

    lineage_timeline(events, newest_first=False)
    assert lineage.data["items"] == [
        "dated",
        "early",
        "late",
        "day",
        "none",
        "text",
    ]


def test_split_reads_the_value_of_the_focus_and_its_parts(lineage):
    def order(name, quantity=None):
        fields = {} if quantity is None else {"Quantity": quantity}
        return Record("Batch", name, id=name, fields=fields)

    batches = [order("whole", 100), order("a", 60), order("b", 25.5)]
    links = [Link("whole", "a", "part"), Link("whole", "b", "part")]
    lineage_split(batches, links, focus="whole", value="Quantity")
    data = lineage.data
    assert data["parts"] == ["a", "b"]
    assert data["values"] == {"whole": 100.0, "a": 60.0, "b": 25.5}
    assert edge_set(data) == {
        ("whole", "a", "part", False),
        ("whole", "b", "part", False),
    }

    lineage_split(
        batches, links, focus="a", value="Quantity", direction="upstream"
    )
    assert lineage.data["parts"] == ["whole"]

    batches[1] = order("a", "sixty")
    with pytest.raises(ValueError, match="must be a number"):
        lineage_split(batches, links, focus="whole", value="Quantity")


def test_sankey_sums_flows_between_the_same_entities(lineage):
    stock = [
        Record(
            "Move",
            "m1",
            id="m1",
            fields={"Qty": 5},
            sources=["Mine"],
            targets=["Forge"],
        ),
        Record(
            "Move",
            "m2",
            id="m2",
            fields={"Qty": 3},
            sources=["Mine"],
            targets=["Forge"],
        ),
        Record(
            "Move",
            "m3",
            id="m3",
            fields={"Qty": 4},
            sources=["Forge"],
            targets=["Town"],
        ),
    ]
    lineage_sankey(stock, value="Qty")
    data = lineage.data
    flows = {(f["from"], f["to"]): f["value"] for f in data["flows"]}
    assert flows == {("Mine", "Forge"): 8, ("Forge", "Town"): 4}


LINKED = {
    "trail": (lineage_trail, {"focus": "hero"}),
    "strip": (lineage_strip, {"focus": "sword"}),
    "graph": (lineage_graph, {}),
    "flow": (lineage_flow, {}),
    "tree": (lineage_tree, {"root": "ore"}),
    "steps": (lineage_steps, {}),
    "timeline": (lineage_timeline, {}),
    "split": (lineage_split, {"focus": "ingot", "value": "Stack"}),
}
CARD_FOCUSED = ["trail", "strip", "graph", "flow", "tree", "timeline"]


@pytest.mark.parametrize("name", LINKED)
def test_selection_and_frame_options_work_on_every_component(
    name, lineage, crafting, session
):
    function, required = LINKED[name]
    records, links = crafting
    lineage.reply = {"selected": "sword"}
    seen = []

    result = function(
        records,
        links,
        selected="ore",
        key="k",
        label="Crafting",
        border=True,
        background=True,
        on_select=lambda *a, **kw: seen.append((a, kw)),
        args=("x",),
        kwargs={"y": 1},
        **required,
    )

    assert result == "sword"
    sent = lineage.calls[0]
    data = sent["data"]
    assert sent["default"] == {"selected": "ore"}
    assert data["selected"] == "ore"
    assert (data["label"], data["border"], data["background"]) == (
        "Crafting",
        True,
        True,
    )
    assert data["edges"]
    session["k"] = {"selected": "sword"}
    sent["on_selected_change"]()
    assert seen == [(("sword", "x"), {"y": 1})]


@pytest.mark.parametrize("name", CARD_FOCUSED)
def test_card_focused_components_style_every_record_from_card_config(
    name, lineage, crafting
):
    function, required = LINKED[name]
    records, links = crafting
    config = card_config.LedgerCard(status_display="dot", background=True)
    function(records, links, card_config=config, on_hover="large", **required)
    data = lineage.data
    assert data["cardVariant"] == "ledger"
    assert data["onHover"] == "large"
    sword = next(n for n in data["nodes"] if n["id"] == "sword")
    assert sword["statusDisplay"] == "dot"
    assert sword["status"] == "Rare"

    function(records, links, status_display=None, **required)
    assert lineage.data["statusDisplay"] is None
    assert all(n["status"] is None for n in lineage.data["nodes"])


@pytest.mark.parametrize("name", ["graph", "flow", "strip"])
def test_highlight_links_modes_reach_the_frontend(name, lineage, crafting):
    function, required = LINKED[name]
    records, links = crafting
    function(records, links, highlight_links="chain", **required)
    assert lineage.data["highlightLinks"] == "chain"
    function(records, links, highlight_links=None, **required)
    assert lineage.data["highlightLinks"] is None


def test_links_may_be_written_as_tuples(lineage, crafting):
    records, links = crafting
    as_tuples = [(l.record_1, l.record_2, l.label, l.directed) for l in links]
    lineage_graph(records, as_tuples)
    from_tuples = lineage.data
    lineage_graph(records, links)
    assert from_tuples == lineage.data


BAD = {
    "a link to a record that does not exist": (
        lambda r, l: lineage_graph(r, [*l, Link("ore", "missing", "x")]),
        "missing",
    ),
    "the same link twice": (
        lambda r, l: lineage_graph(r, [*l, l[0]]),
        "ore",
    ),
    "a link to itself": (lambda r, l: Link("ore", "ore", "x"), "itself"),
    "a focus that is not a record": (
        lambda r, l: lineage_trail(r, l, focus="nope"),
        "nope",
    ),
    "two records with one id": (
        lambda r, l: lineage_graph([*r, r[0]], l),
        "ore",
    ),
    "a links argument that is a table": (
        lambda r, l: lineage_graph(r, __import__("pandas").DataFrame()),
        "from_frame",
    ),
    "a callback without a key": (
        lambda r, l: lineage_graph(r, l, on_select=lambda *a: None),
        "key",
    ),
}


@pytest.mark.parametrize("case", BAD)
def test_bad_input_fails_early_and_names_the_culprit(case, lineage, crafting):
    call, culprit = BAD[case]
    with pytest.raises((ValueError, TypeError), match=culprit):
        call(*crafting)
    assert lineage.calls == []


@pytest.mark.parametrize("name", CARD_FOCUSED)
def test_a_record_without_the_ledger_headline_is_drawn_without_one(
    name, lineage, crafting, recwarn
):
    function, required = LINKED[name]
    records, links = crafting
    config = card_config.LedgerCard(headline="Damage")

    function(records, links, card_config=config, **required)

    data = lineage.data
    assert data["cardVariant"] == "ledger"
    assert [w for w in recwarn if "Damage" in str(w.message)] == []
    has_damage = {
        r.id for r in records if r.fields and r.fields[0].label == "Damage"
    }
    for node in data["nodes"]:
        assert "variant" not in node
        headline = node["hover"]["headline"]
        assert (headline is not None) == (node["id"] in has_damage)
