import { describe, expect, it } from "vitest";
import {
  countBeneath,
  edgeSentence,
  flatten,
  type Item,
  navigate,
  place,
  startsOpen,
  type TreeNode,
  visible,
} from "./layout";

const node = (
  id: string,
  children: TreeNode[] = [],
  extra: Partial<TreeNode> = {}
): TreeNode => ({ id, relationship: null, children, repeat: false, more: false, ...extra });

const tree = node("root", [
  node("a", [node("a1"), node("a2")]),
  node("b", [node("b1", [], { repeat: true })]),
  node("c"),
]);
const items = flatten(place(tree));
const find = (id: string): Item => items.find((item) => item.node.id === id)!;
const ids = (list: Item[]): string[] => list.map((item) => item.node.id);
const openExcept =
  (...closed: string[]) =>
  (item: Item): boolean =>
    !closed.includes(item.node.id);

describe("place", () => {
  it("lists items in display order with depths and parents", () => {
    expect(ids(items)).toEqual(["root", "a", "a1", "a2", "b", "b1", "c"]);
    expect(find("a2").depth).toBe(2);
    expect(find("a2").parent).toBe(find("a"));
    expect(find("root").parent).toBeNull();
  });

  it("names items by the ids from the root", () => {
    expect(new Set(items.map((item) => item.path)).size).toBe(items.length);
    expect(find("a1").path.startsWith(find("a").path)).toBe(true);
  });
});

describe("countBeneath", () => {
  it("counts the records beneath a node", () => {
    expect(countBeneath(tree)).toBe(5);
    expect(countBeneath(tree.children[0])).toBe(2);
    expect(countBeneath(tree.children[2])).toBe(0);
  });

  it("leaves out records shown elsewhere", () => {
    expect(countBeneath(tree.children[1])).toBe(0);
  });
});

describe("startsOpen", () => {
  it("opens the first levels, counting the root as the first", () => {
    expect(startsOpen(find("root"), 0)).toBe(false);
    expect(startsOpen(find("root"), 1)).toBe(true);
    expect(startsOpen(find("a"), 1)).toBe(false);
    expect(startsOpen(find("a"), 2)).toBe(true);
  });
});

describe("visible", () => {
  it("shows every item when all are open", () => {
    expect(visible(items, openExcept())).toEqual(items);
  });

  it("hides the items beneath a closed one", () => {
    expect(ids(visible(items, openExcept("a")))).toEqual(["root", "a", "b", "b1", "c"]);
    expect(ids(visible(items, openExcept("root", "a")))).toEqual(["root"]);
  });
});

describe("navigate", () => {
  const rows = visible(items, openExcept());
  const go = (from: string, key: string, open = openExcept()) =>
    navigate(rows, find(from), key, open);

  it("moves between rows and to the ends", () => {
    expect(go("a", "ArrowDown")).toEqual({ focus: find("a1") });
    expect(go("a1", "ArrowUp")).toEqual({ focus: find("a") });
    expect(go("root", "ArrowUp")).toBeNull();
    expect(go("c", "ArrowDown")).toBeNull();
    expect(go("a1", "Home")).toEqual({ focus: find("root") });
    expect(go("a1", "End")).toEqual({ focus: find("c") });
  });

  it("moves into the children with Right when open", () => {
    expect(go("a", "ArrowRight")).toEqual({ focus: find("a1") });
    expect(go("c", "ArrowRight")).toBeNull();
  });

  it("opens a closed item with Right and closes an open one with Left", () => {
    expect(go("a", "ArrowRight", openExcept("a"))).toEqual({ open: find("a"), value: true });
    expect(go("a", "ArrowLeft")).toEqual({ open: find("a"), value: false });
  });

  it("moves to the parent with Left from a leaf or a closed item", () => {
    expect(go("a2", "ArrowLeft")).toEqual({ focus: find("a") });
    expect(go("a", "ArrowLeft", openExcept("a"))).toEqual({ focus: find("root") });
    expect(go("c", "ArrowLeft")).toEqual({ focus: find("root") });
  });

  it("ignores other keys and items that are not showing", () => {
    expect(go("a", "x")).toBeNull();
    expect(navigate([], find("a"), "ArrowDown", openExcept())).toBeNull();
  });
});

describe("edgeSentence", () => {
  it("reads downstream edges from the parent", () => {
    expect(edgeSentence("downstream", "LOT-R-117", "WO-551", "consumed by")).toBe(
      "LOT-R-117 consumed by WO-551"
    );
  });

  it("reads upstream edges from the child", () => {
    expect(edgeSentence("upstream", "SHP-7002", "LOT-F-900", "shipped on")).toBe(
      "LOT-F-900 shipped on SHP-7002"
    );
  });
});
