import { describe, expect, it } from "vitest";
import type { LineageEdge } from "../../shared/lineage";
import { focusRoles, formatDay, formatTime, groupByDay, itemLinks, parseIso } from "./layout";

const edge = (from: string, to: string, relationship = "", related = false): LineageEdge => ({
  from,
  to,
  relationship,
  related,
});

describe("parseIso", () => {
  it("reads a date and a datetime", () => {
    expect(parseIso("2026-10-09")).toEqual({
      year: 2026,
      month: 10,
      day: 9,
      hour: null,
      minute: null,
    });
    expect(parseIso("2026-10-09T09:15:30")).toMatchObject({ hour: 9, minute: 15 });
  });

  it("keeps the written time when there is an offset", () => {
    expect(parseIso("2026-10-09T23:30:00+09:00")).toMatchObject({ day: 9, hour: 23, minute: 30 });
  });

  it("rejects missing and malformed values", () => {
    expect(parseIso(null)).toBeNull();
    expect(parseIso(undefined)).toBeNull();
    expect(parseIso("Q3 2026")).toBeNull();
  });
});

describe("groupByDay", () => {
  const iso: Record<string, string | null> = {
    a: "2026-10-09T09:15:00",
    b: "2026-10-09T11:00:00",
    c: "2026-10-10",
    d: null,
    e: null,
  };

  it("groups consecutive records of a day and ends with undated ones", () => {
    expect(groupByDay(["a", "b", "c", "d", "e"], (id) => iso[id])).toEqual([
      { day: "2026-10-09", ids: ["a", "b"] },
      { day: "2026-10-10", ids: ["c"] },
      { day: null, ids: ["d", "e"] },
    ]);
  });

  it("keeps the given order", () => {
    expect(groupByDay(["c", "b", "a"], (id) => iso[id]).map((g) => g.day)).toEqual([
      "2026-10-10",
      "2026-10-09",
    ]);
  });

  it("returns no groups without records", () => {
    expect(groupByDay([], () => null)).toEqual([]);
  });
});

describe("formatDay and formatTime", () => {
  const stamp = parseIso("2026-10-09T09:15:00")!;

  it("formats in the given locale without shifting the day", () => {
    expect(formatDay(stamp, "en-US")).toBe("Fri, Oct 9, 2026");
    expect(formatDay(stamp, "de-DE")).toMatch(/^Fr\.?, 9\. Okt\.? 2026$/);
    expect(formatTime(stamp, "en-US")).toMatch(/^9:15\s?AM$/);
    expect(formatTime(stamp, "de-DE")).toMatch(/^0?9:15$/);
  });

  it("formats late evening times as written", () => {
    const late = parseIso("2026-10-09T23:30:00-07:00")!;
    expect(formatDay(late, "en-US")).toBe("Fri, Oct 9, 2026");
    expect(formatTime(late, "en-US")).toMatch(/^11:30\s?PM$/);
  });

  it("has no time for a date-only stamp", () => {
    expect(formatTime(parseIso("2026-10-09")!, "en-US")).toBeNull();
  });
});

describe("focusRoles", () => {
  const edges = [edge("a", "b"), edge("b", "c"), edge("d", "b", "", true)];

  it("names the focus, its neighbors in either direction, and the rest", () => {
    const roles = focusRoles(["a", "b", "c", "d", "e"], edges, "b");
    expect([...roles]).toEqual([
      ["a", "linked"],
      ["b", "focus"],
      ["c", "linked"],
      ["d", "linked"],
      ["e", "muted"],
    ]);
  });

  it("is empty without a focus", () => {
    expect(focusRoles(["a", "b"], edges, null).size).toBe(0);
  });
});

describe("itemLinks", () => {
  const edges = [
    edge("b", "c", "billed on"),
    edge("a", "b", "fulfills"),
    edge("b", "d", "returned on", true),
    edge("x", "y"),
  ];

  it("lists earlier, later, then related records with their direction", () => {
    expect(itemLinks("b", edges, ["x", "a", "y", "b", "z", "c", "d"])).toEqual([
      { id: "a", relationship: "fulfills", direction: "from", edge: ["a", "b"] },
      { id: "c", relationship: "billed on", direction: "to", edge: ["b", "c"] },
      { id: "d", relationship: "returned on", direction: "related", edge: ["b", "d"] },
    ]);
  });

  it("leaves out links to the next and previous item", () => {
    expect(itemLinks("b", edges, ["a", "b", "c", "x", "d"]).map((link) => link.id)).toEqual(["d"]);
  });

  it("is empty for an unlinked item", () => {
    expect(itemLinks("z", edges, ["z"])).toEqual([]);
  });
});
