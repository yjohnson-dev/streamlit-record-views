import { describe, expect, it } from "vitest";
import { chainEdges, highlightedEdges } from "./chain";
import type { LineageEdge } from "./lineage";

const edge = (from: string, to: string, related = false): LineageEdge => ({
  from,
  to,
  relationship: "",
  related,
});

const summary = (edges: LineageEdge[], id: string): string[] =>
  chainEdges(edges, id).map(({ edge: e, depth }) => `${e.from}>${e.to}:${depth}`);

describe("chainEdges", () => {
  const straight = [edge("A", "B"), edge("B", "C"), edge("C", "D")];

  it("numbers a straight chain from its earliest ancestor", () => {
    expect(summary(straight, "C")).toEqual(["A>B:0", "B>C:1", "C>D:2"]);
    expect(summary(straight, "A")).toEqual(["A>B:0", "B>C:1", "C>D:2"]);
    expect(summary(straight, "D")).toEqual(["A>B:0", "B>C:1", "C>D:2"]);
  });

  it("uses the longest path in a diamond", () => {
    const diamond = [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D"), edge("D", "E")];
    expect(summary(diamond, "D")).toEqual(["A>B:0", "A>C:0", "B>D:1", "C>D:1", "D>E:2"]);
  });

  it("waits for the longer of two paths into a record", () => {
    const skip = [edge("A", "B"), edge("B", "C"), edge("A", "C"), edge("C", "D")];
    expect(summary(skip, "C")).toEqual(["A>B:0", "B>C:1", "A>C:0", "C>D:2"]);
  });

  it("leaves out the branches that do not lead to or from the record", () => {
    const branch = [edge("A", "B"), edge("A", "X"), edge("B", "C"), edge("B", "D"), edge("Y", "C")];
    expect(summary(branch, "B")).toEqual(["A>B:0", "B>C:1", "B>D:1"]);
    expect(summary(branch, "C")).toEqual(["A>B:0", "B>C:1", "Y>C:0"]);
  });

  it("ends on a cycle without hanging", () => {
    const loop = [edge("S", "A"), edge("A", "B"), edge("B", "C"), edge("C", "A"), edge("C", "T")];
    const found = chainEdges(loop, "B");
    expect(found).toHaveLength(5);
    for (const { depth } of found) expect(depth).toBeLessThan(5);
    expect(summary([edge("A", "B"), edge("B", "A")], "A")).toHaveLength(2);
  });

  it("highlights an undirected edge only at the record and does not follow it", () => {
    const edges = [edge("A", "B"), edge("B", "R", true), edge("R", "Z", true), edge("Q", "A", true)];
    expect(summary(edges, "B")).toEqual(["A>B:0", "B>R:0"]);
    expect(summary(edges, "A")).toEqual(["A>B:0", "Q>A:0"]);
    expect(summary(edges, "R")).toEqual(["B>R:0", "R>Z:0"]);
  });

  it("finds nothing for a record without links", () => {
    expect(chainEdges(straight, "Z")).toEqual([]);
    expect(chainEdges([], "A")).toEqual([]);
  });
});

describe("highlightedEdges", () => {
  const edges = [edge("A", "B"), edge("B", "C"), edge("C", "D"), edge("B", "R", true)];

  it("takes only the links of the record when direct", () => {
    const found = highlightedEdges(edges, "B", "direct").map(({ edge: e }) => `${e.from}>${e.to}`);
    expect(found).toEqual(["A>B", "B>C", "B>R"]);
  });

  it("takes the chain when asked", () => {
    expect(highlightedEdges(edges, "B", "chain")).toEqual(chainEdges(edges, "B"));
  });
});
