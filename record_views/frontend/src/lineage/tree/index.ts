import { el, icon, titleText } from "../../shared/dom";
import {
  type LineageData,
  lineageRenderer,
  nodeLabel,
  titleOrId,
} from "../../shared/lineage";
import type { Direction } from "../../shared/types";
import { markFades } from "../../shared/view";
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
import "./style.css";

interface TreeData extends LineageData {
  tree: TreeNode;
  direction: Direction;
  expanded: number;
}

const OF = { downstream: "downstream of", upstream: "upstream of" };

/** Whether the user opened or closed each item, by tree key and path. */
const toggled = new Map<string, boolean>();

interface Branch {
  toggle: HTMLElement;
  group: HTMLElement;
  count: HTMLElement;
}

interface Row {
  li: HTMLElement;
  chip: HTMLElement;
  branch: Branch | null;
}

export default lineageRenderer<TreeData>("Lineage tree", (ctx) => {
  const { data } = ctx;
  const top = place(data.tree);
  const items = flatten(top);
  const rows = new Map<Item, Row>();
  const byPath = new Map(items.map((item) => [item.path, item]));
  const keyOf = (item: Item): string => `${ctx.key}\u001f${item.path}`;
  const isOpen = (item: Item): boolean =>
    toggled.get(keyOf(item)) ?? startsOpen(item, data.expanded);
  const title = (item: Item): string => titleOrId(ctx.get(item.node.id), item.node.id);

  let tabbable: HTMLElement | null = null;
  const setTabbable = (chip: HTMLElement): void => {
    tabbable?.setAttribute("tabindex", "-1");
    chip.tabIndex = 0;
    tabbable = chip;
  };

  const paint = (item: Item): void => {
    const { li, branch } = rows.get(item)!;
    if (!branch) return;
    const open = isOpen(item);
    li.classList.toggle("is-open", open);
    li.setAttribute("aria-expanded", String(open));
    branch.group.hidden = !open;
    branch.count.hidden = open;
    branch.toggle.setAttribute(
      "aria-label",
      `${open ? "Collapse" : "Expand"} ${title(item)}`
    );
  };

  const setOpen = (item: Item, open: boolean): void => {
    toggled.set(keyOf(item), open);
    paint(item);
    const { chip, branch } = rows.get(item)!;
    if (!branch) return;
    if (!open && tabbable && branch.group.contains(tabbable)) {
      const active = (list.getRootNode() as Document | ShadowRoot).activeElement;
      setTabbable(chip);
      if (active && branch.group.contains(active)) chip.focus();
    }
    markFades(branch.group);
  };

  const build = (item: Item): HTMLElement => {
    const node = ctx.get(item.node.id)!;
    const { relationship, repeat, more } = item.node;
    const sentence =
      item.parent && relationship
        ? edgeSentence(data.direction, title(item.parent), titleText(node), relationship)
        : null;
    const note = repeat ? "shown above" : more ? "more beyond depth limit" : null;

    const chip = ctx.node(node, { card: "tile", emphasis: item.depth === 0 });
    chip.tabIndex = -1;
    chip.setAttribute(
      "aria-label",
      [nodeLabel(node), sentence, note].filter(Boolean).join(", ")
    );

    const label = relationship ? el("span", "lin-tree-relationship", relationship) : null;
    if (label && sentence) label.title = sentence;
    const content = el(
      "div",
      "lin-tree-content",
      chip,
      label,
      note ? el("span", "lin-tree-note", note) : null
    );
    const li = el("li", "lin-tree-item");
    li.setAttribute("role", "treeitem");
    li.setAttribute("aria-level", String(item.depth + 1));
    li.dataset.path = item.path;
    if (!item.children.length) {
      li.classList.add("is-leaf");
      li.append(el("div", "lin-tree-row", content));
      rows.set(item, { li, chip, branch: null });
      return li;
    }

    const hidden = countBeneath(item.node);
    const count = el("span", "lin-tree-count", `+${hidden}`);
    count.title = `${hidden} ${hidden === 1 ? "record" : "records"} hidden`;
    content.append(count);
    const toggle = el("button", "lin-tree-toggle", icon(":material/chevron_right:"));
    toggle.setAttribute("type", "button");
    toggle.tabIndex = -1;
    toggle.addEventListener("click", () => setOpen(item, !isOpen(item)));
    const group = el("ul", "lin-tree-group", ...item.children.map(build));
    group.setAttribute("role", "group");
    li.append(el("div", "lin-tree-row", toggle, content), group);
    rows.set(item, { li, chip, branch: { toggle, group, count } });
    return li;
  };

  const list = el("ul", "lin-tree-list", build(top));
  list.setAttribute("role", "tree");
  list.setAttribute("aria-label", `Records ${OF[data.direction]} ${title(top)}`);
  for (const item of items) paint(item);
  setTabbable(rows.get(top)!.chip);

  list.addEventListener("focusin", (event) => {
    const chip = (event.target as Element).closest<HTMLElement>("[data-id]");
    if (chip) setTabbable(chip);
  });
  list.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const li = (event.target as Element).closest<HTMLElement>(".lin-tree-item");
    const item = li?.dataset.path ? byPath.get(li.dataset.path) : undefined;
    const move = item && navigate(visible(items, isOpen), item, event.key, isOpen);
    if (!move) return;
    event.preventDefault();
    if ("focus" in move) rows.get(move.focus)!.chip.focus();
    else setOpen(move.open, move.value);
  });

  return el("div", "lin-tree", list);
}, { vertical: true });
