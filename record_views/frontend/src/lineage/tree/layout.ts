import type { Direction } from "../../shared/types";

export interface TreeNode {
  id: string;
  /** The label of the edge from its parent; null at the root. */
  relationship: string | null;
  children: TreeNode[];
  /** Whether the node already appears elsewhere and has no children here. */
  repeat: boolean;
  /** Whether levels beyond the depth limit were cut off beneath it. */
  more: boolean;
}

export interface Item {
  /** Identifies the item by the ids from the root, so it survives reruns. */
  path: string;
  node: TreeNode;
  depth: number;
  parent: Item | null;
  children: Item[];
}

export type Move = { focus: Item } | { open: Item; value: boolean } | null;

const SEPARATOR = "\u001f";

export function place(node: TreeNode, parent: Item | null = null): Item {
  const item: Item = {
    path: parent ? `${parent.path}${SEPARATOR}${node.id}` : node.id,
    node,
    depth: parent ? parent.depth + 1 : 0,
    parent,
    children: [],
  };
  item.children = node.children.map((child) => place(child, item));
  return item;
}

export function flatten(item: Item, into: Item[] = []): Item[] {
  into.push(item);
  for (const child of item.children) flatten(child, into);
  return into;
}

/** Counts the records beneath a node, leaving out ones shown elsewhere. */
export function countBeneath(node: TreeNode): number {
  return node.children.reduce(
    (total, child) => total + (child.repeat ? 0 : 1 + countBeneath(child)),
    0
  );
}

/** Reads an edge as a sentence, such as "WO-551 produced LOT-F-900". */
export function edgeSentence(
  direction: Direction,
  parent: string,
  child: string,
  relationship: string
): string {
  return direction === "downstream"
    ? `${parent} ${relationship} ${child}`
    : `${child} ${relationship} ${parent}`;
}

export const startsOpen = (item: Item, levels: number): boolean => item.depth < levels;

export function visible(items: Item[], isOpen: (item: Item) => boolean): Item[] {
  const shown: Item[] = [];
  let hiddenBelow: number | null = null;
  for (const item of items) {
    if (hiddenBelow !== null) {
      if (item.depth > hiddenBelow) continue;
      hiddenBelow = null;
    }
    shown.push(item);
    if (item.children.length && !isOpen(item)) hiddenBelow = item.depth;
  }
  return shown;
}

/** Decides what an arrow, Home, or End key does from an item in the shown rows. */
export function navigate(
  rows: Item[],
  from: Item,
  key: string,
  isOpen: (item: Item) => boolean
): Move {
  const index = rows.indexOf(from);
  if (index < 0) return null;
  const focus = (item: Item | undefined): Move => (item ? { focus: item } : null);
  const expandable = from.children.length > 0;
  switch (key) {
    case "ArrowDown":
      return focus(rows[index + 1]);
    case "ArrowUp":
      return focus(rows[index - 1]);
    case "Home":
      return focus(rows[0]);
    case "End":
      return focus(rows[rows.length - 1]);
    case "ArrowRight":
      if (!expandable) return null;
      return isOpen(from) ? focus(from.children[0]) : { open: from, value: true };
    case "ArrowLeft":
      if (expandable && isOpen(from)) return { open: from, value: false };
      return focus(from.parent ?? undefined);
    default:
      return null;
  }
}
