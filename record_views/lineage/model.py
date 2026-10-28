from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from record_views.link import Link
from record_views.record import Record


@dataclass(frozen=True)
class LineageEdge:
    """A connection between two records, resolved from a link.

    Attributes:
        upstream: The id of the earlier record. For a related edge, the id
            that sorts first.
        downstream: The id of the later record. For a related edge, the id
            that sorts second.
        relationship: The link's label, or an empty string if it has none.
        related: Whether the link is undirected.
    """

    upstream: str
    downstream: str
    relationship: str
    related: bool = False


class LineageGraph:
    """Records and the edges between them, resolved from links.

    Args:
        records: The records to connect. Every record needs a unique id.
        links: The relations between the records. A directed link is an
            edge from record_1 to record_2. An undirected link is a related
            edge. Links from A to B and from B to A can both be given, and
            cycles are allowed.

    Raises:
        ValueError: If a record has no id, two records share an id, a link
            names an id that no record has, or the same relation is given
            twice: the same directed link, or two undirected links between
            the same records in either order.
    """

    def __init__(
        self, records: Iterable[Record], links: Iterable[Link] = ()
    ) -> None:
        self._records: dict[str, Record] = {}
        for record in records:
            if record.id is None:
                raise ValueError(
                    f"Lineage records need an id; {record.title!r} has none."
                )
            if record.id in self._records:
                raise ValueError(f"Duplicate record id {record.id!r}.")
            self._records[record.id] = record

        resolved: dict[tuple[str, str, bool], LineageEdge] = {}
        for link in links:
            for record_id in (link.record_1, link.record_2):
                if record_id not in self._records:
                    raise ValueError(
                        f"{link!r} names the id {record_id!r}, "
                        "which no record has."
                    )
            related = not link.directed
            if related:
                upstream, downstream = sorted((link.record_1, link.record_2))
            else:
                upstream, downstream = link.record_1, link.record_2
            key = (upstream, downstream, related)
            if key in resolved:
                raise ValueError(f"{link!r} repeats an earlier link.")
            resolved[key] = LineageEdge(
                upstream, downstream, link.label or "", related
            )
        self.edges: tuple[LineageEdge, ...] = tuple(resolved.values())

        self._pairs: dict[frozenset[str], LineageEdge] = {}
        for edge in self.edges:
            pair = frozenset((edge.upstream, edge.downstream))
            if pair not in self._pairs or self._pairs[pair].related:
                self._pairs[pair] = edge

        self._parents: dict[str, list[str]] = {}
        self._children: dict[str, list[str]] = {}
        self._related: dict[str, list[str]] = {}
        for edge in self.edges:
            if edge.related:
                self._related.setdefault(edge.upstream, []).append(
                    edge.downstream
                )
                self._related.setdefault(edge.downstream, []).append(
                    edge.upstream
                )
            else:
                self._children.setdefault(edge.upstream, []).append(
                    edge.downstream
                )
                self._parents.setdefault(edge.downstream, []).append(
                    edge.upstream
                )

    @property
    def ids(self) -> list[str]:
        """Every record id, in input order."""
        return list(self._records)

    def __contains__(self, record_id: object) -> bool:
        return record_id in self._records

    def record(self, record_id: str) -> Record:
        """Returns the record for an id.

        Returns:
            The record.

        Raises:
            KeyError: If the id is not in the graph.
        """
        return self._records[record_id]

    def require(self, record_id: str) -> str:
        """Validates that an id is in the graph.

        Args:
            record_id: The id to check.

        Returns:
            The id.

        Raises:
            ValueError: If no record has the id.
        """
        if record_id not in self:
            raise ValueError(f"No record with id {record_id!r}.")
        return record_id

    def parents(self, record_id: str) -> list[str]:
        """Returns the ids directly upstream of a node, in link order."""
        return list(self._parents.get(record_id, ()))

    def children(self, record_id: str) -> list[str]:
        """Returns the ids directly downstream of a node, in link order."""
        return list(self._children.get(record_id, ()))

    def related(self, record_id: str) -> list[str]:
        """Returns the ids related to a node without direction."""
        return list(self._related.get(record_id, ()))

    def ancestors(self, record_id: str, depth: int | None = None) -> list[str]:
        """Returns the ids upstream of a node, nearest first.

        Args:
            record_id: The starting node.
            depth: The number of hops to follow, or None for all.

        Returns:
            Ancestor ids in breadth-first order, excluding the start.
        """
        return self._walk(record_id, self._parents, depth)

    def descendants(
        self, record_id: str, depth: int | None = None
    ) -> list[str]:
        """Returns the ids downstream of a node, nearest first.

        Args:
            record_id: The starting node.
            depth: The number of hops to follow, or None for all.

        Returns:
            Descendant ids in breadth-first order, excluding the start.
        """
        return self._walk(record_id, self._children, depth)

    def path_to(self, record_id: str) -> list[str]:
        """Returns the upstream path from a root to a node.

        Args:
            record_id: The node the path ends at.

        Returns:
            Ids from the root to record_id, inclusive, following the first
            parent of each node and stopping at a root or a repeated node.
        """
        path = [record_id]
        while parents := [p for p in self.parents(path[0]) if p not in path]:
            path.insert(0, parents[0])
        return path

    def path_from(self, record_id: str) -> list[str]:
        """Returns the downstream path from a node while it does not branch.

        Args:
            record_id: The node the path starts at.

        Returns:
            Ids from record_id onward, inclusive, stopping before a node with
            more than one child or at a leaf.
        """
        path = [record_id]
        while len(children := self.children(path[-1])) == 1:
            if children[0] in path:
                break
            path.append(children[0])
        return path

    def edge(self, a: str, b: str) -> LineageEdge | None:
        """Returns the edge between two nodes in either direction.

        Args:
            a: One node id.
            b: The other node id.

        Returns:
            The directed edge between them if there is one, else the related
            edge, else None.
        """
        return self._pairs.get(frozenset((a, b)))

    def edges_within(self, ids: Iterable[str]) -> list[LineageEdge]:
        """Returns the edges whose two ends are both among the given ids."""
        members = set(ids)
        return [
            edge
            for edge in self.edges
            if edge.upstream in members and edge.downstream in members
        ]

    def levels(self, ids: Sequence[str] | None = None) -> dict[str, int]:
        """Assigns each node a layer by its longest upstream path.

        Args:
            ids: The nodes to lay out, or None for every node.

        Returns:
            A mapping from id to layer, starting at 0 for nodes with no
            upstream within the set. A node with no upstream but related
            nodes moves down to the layer of the earliest of them, such as a
            return beside the shipment it returns. Edges that would close a
            cycle do not affect layers.
        """
        members = list(ids if ids is not None else self.ids)
        member_set = set(members)
        children = {
            node: [c for c in self._children.get(node, ()) if c in member_set]
            for node in members
        }
        order: list[str] = []
        state: dict[str, int] = {}
        back_edges: set[tuple[str, str]] = set()
        for root in members:
            if root in state:
                continue
            state[root] = 1
            stack = [(root, iter(children[root]))]
            while stack:
                node, pending = stack[-1]
                for child in pending:
                    if state.get(child) == 1:
                        back_edges.add((node, child))
                    elif child not in state:
                        state[child] = 1
                        stack.append((child, iter(children[child])))
                        break
                else:
                    state[node] = 2
                    order.append(node)
                    stack.pop()
        order.reverse()

        def assign(floor: dict[str, int]) -> dict[str, int]:
            level = {node: floor.get(node, 0) for node in members}
            for node in order:
                for child in children[node]:
                    if (node, child) not in back_edges:
                        level[child] = max(level[child], level[node] + 1)
            return level

        level = assign({})
        has_parent = {
            child
            for node in members
            for child in children[node]
            if (node, child) not in back_edges
        }
        floor = {}
        for node in members:
            related = [n for n in self.related(node) if n in member_set]
            if node not in has_parent and related:
                floor[node] = min(level[n] for n in related)
        return assign(floor) if floor else level

    def layers(self, ids: Sequence[str] | None = None) -> list[list[str]]:
        """Groups nodes into layers and orders each layer to reduce crossings.

        Args:
            ids: The nodes to lay out, or None for every node.

        Returns:
            Layers from upstream to downstream, each a list of ids ordered by
            the barycenter of their neighbors in adjacent layers. A node
            with no upstream follows a related node in its layer.
        """
        level = self.levels(ids)
        count = max(level.values(), default=-1) + 1
        layers: list[list[str]] = [[] for _ in range(count)]
        for node in level:
            layers[level[node]].append(node)

        def reorder(
            layer: list[str],
            neighbors: dict[str, list[str]],
            reference: list[str],
        ) -> list[str]:
            position = {node: i for i, node in enumerate(reference)}
            current = {node: i for i, node in enumerate(layer)}

            def center(node: str) -> float:
                linked = [
                    position[n]
                    for n in neighbors.get(node, ())
                    if n in position
                ]
                return sum(linked) / len(linked) if linked else current[node]

            return attach(
                sorted(layer, key=lambda node: (center(node), current[node]))
            )

        def attach(layer: list[str]) -> list[str]:
            members = set(layer)
            partner = {
                node: next(n for n in self.related(node) if n in members)
                for node in layer
                if not any(n in level for n in self._parents.get(node, ()))
                and any(n in members for n in self.related(node))
            }
            follows = {n: p for n, p in partner.items() if p not in partner}
            placed: list[str] = []
            for node in layer:
                if node in follows:
                    continue
                placed.append(node)
                placed.extend(n for n in layer if follows.get(n) == node)
            return placed

        for _ in range(4):
            for i in range(1, count):
                layers[i] = reorder(layers[i], self._parents, layers[i - 1])
            for i in range(count - 2, -1, -1):
                layers[i] = reorder(layers[i], self._children, layers[i + 1])
        return layers

    def sequence(self, ids: Sequence[str] | None = None) -> list[str]:
        """Orders nodes so every node follows its upstream nodes.

        Args:
            ids: The nodes to order, or None for every node.

        Returns:
            The ids in upstream-to-downstream order, keeping input order for
            ties and breaking cycles in input order.
        """
        level = self.levels(ids)
        position = {node: i for i, node in enumerate(level)}
        return sorted(level, key=lambda node: (level[node], position[node]))

    def _walk(
        self, start: str, step: dict[str, list[str]], depth: int | None
    ) -> list[str]:
        seen = {start}
        frontier = [start]
        found: list[str] = []
        hops = 0
        while frontier and (depth is None or hops < depth):
            hops += 1
            following: list[str] = []
            for node in frontier:
                for neighbor in step.get(node, ()):
                    if neighbor not in seen:
                        seen.add(neighbor)
                        found.append(neighbor)
                        following.append(neighbor)
            frontier = following
        return found
