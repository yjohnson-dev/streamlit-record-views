import { describe, expect, it } from "vitest";
import type { LineageEdge } from "../../shared/lineage";
import {
  LANE_REM,
  STAGE_GAP_REM,
  STAGE_REM,
  assignTracks,
  isStacked,
  resolveMode,
  splitEdges,
} from "./layout";

const rem = 16;
const needed = (stages: number): number =>
  (stages * STAGE_REM + (stages - 1) * STAGE_GAP_REM) * rem;

const edge = (from: string, to: string): LineageEdge => ({
  from,
  to,
  relationship: "",
  related: false,
});

describe("isStacked", () => {
  it("keeps columns while every stage gets its minimum width", () => {
    expect(isStacked(8, needed(8), rem)).toBe(false);
    expect(isStacked(8, needed(8) - 1, rem)).toBe(true);
  });

  it("stacks sooner as stages are added", () => {
    expect(isStacked(4, 600, rem)).toBe(false);
    expect(isStacked(8, 600, rem)).toBe(true);
  });

  it("stacks narrow containers", () => {
    expect(isStacked(5, 260, rem)).toBe(true);
    expect(isStacked(5, 420, rem)).toBe(true);
  });

  it("stacks a lone stage, which has no column to connect across", () => {
    expect(isStacked(1, 4000, rem)).toBe(true);
    expect(isStacked(0, 4000, rem)).toBe(true);
  });
});

describe("resolveMode", () => {
  it("picks by width when auto", () => {
    expect(resolveMode("auto", 4, needed(4), rem)).toBe("columns");
    expect(resolveMode("auto", 4, 300, rem)).toBe("stacked");
    expect(resolveMode("auto", 4, LANE_REM * rem + 1, rem)).toBe("columns");
    expect(resolveMode("auto", 8, 500, rem)).toBe("stacked");
    expect(resolveMode("auto", 8, 700, rem)).toBe("lanes");
    expect(resolveMode("auto", 8, 1000, rem)).toBe("columns");
  });

  it("keeps columns when horizontal, however narrow", () => {
    expect(resolveMode("horizontal", 8, 300, rem)).toBe("columns");
    expect(resolveMode("horizontal", 1, 4000, rem)).toBe("columns");
  });

  it("keeps rows when vertical, however wide", () => {
    expect(resolveMode("vertical", 3, 4000, rem)).toBe("lanes");
    expect(resolveMode("vertical", 3, 400, rem)).toBe("stacked");
  });
});

describe("splitEdges", () => {
  const edges = [edge("a", "b"), edge("b", "c"), edge("a", "d"), edge("x", "y")];

  it("keeps edges whose two ends are both on the path", () => {
    const [onPath, offPath] = splitEdges(edges, new Set(["a", "b", "c"]));
    expect(onPath).toEqual([edges[0], edges[1]]);
    expect(offPath).toEqual([edges[2], edges[3]]);
  });

  it("sends every edge off the path when the path is empty", () => {
    const [onPath, offPath] = splitEdges(edges, new Set());
    expect(onPath).toEqual([]);
    expect(offPath).toEqual(edges);
  });
});

describe("assignTracks", () => {
  it("keeps a chain in one track so a skipping edge crosses empty cells", () => {
    const { track, count } = assignTracks(
      [["Q"], ["RMA", "PO"], ["SO"], ["INV"]],
      [edge("Q", "SO"), edge("PO", "SO"), edge("SO", "INV")]
    );
    expect(track.get("Q")).toBe(0);
    expect(track.get("SO")).toBe(0);
    expect(track.get("INV")).toBe(0);
    expect(track.get("RMA")).not.toBe(0);
    expect(track.get("PO")).not.toBe(0);
    expect(count).toBe(3);
  });

  it("continues the earliest parent's track", () => {
    const { track } = assignTracks(
      [["A"], ["B"], ["C"]],
      [edge("B", "C"), edge("A", "C")]
    );
    expect(track.get("C")).toBe(track.get("A"));
  });

  it("gives a second child its own track", () => {
    const { track } = assignTracks([["A"], ["B", "C"]], [edge("A", "B"), edge("A", "C")]);
    expect(track.get("B")).toBe(0);
    expect(track.get("C")).toBe(1);
  });

  it("packs chains whose stage spans do not overlap into one track", () => {
    const { track, count } = assignTracks(
      [["A"], ["B", "X"], ["C"], ["Y"]],
      [edge("A", "B"), edge("A", "C"), edge("X", "Y")]
    );
    expect(track.get("A")).toBe(0);
    expect(track.get("C")).toBe(0);
    expect(track.get("B")).toBe(1);
    expect(track.get("X")).toBe(2);
    expect(count).toBe(3);
  });

  it("ignores related and backward edges", () => {
    const related = { ...edge("A", "B"), related: true };
    const { count } = assignTracks([["A"], ["B"]], [related, edge("B", "A")]);
    expect(count).toBe(1);
  });
});
