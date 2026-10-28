import { el, titleText } from "../../shared/dom";
import {
  type LineageContext,
  type LineageData,
  type LineageNode,
  lineageRenderer,
  nodeLabel,
  paintColors,
  titleOrId,
} from "../../shared/lineage";
import {
  type DayGroup,
  focusRoles,
  formatDay,
  formatTime,
  groupByDay,
  type ItemLink,
  itemLinks,
  parseIso,
  type Role,
} from "./layout";
import "./style.css";

interface TimelineData extends LineageData {
  items: string[];
  focus: string | null;
  newestFirst: boolean;
}

const LINK_WORDS = { from: "From", to: "To", related: "Related to" };

function linkChip(
  ctx: LineageContext<TimelineData>,
  target: LineageNode,
  link: ItemLink
): HTMLElement {
  const word = LINK_WORDS[link.direction];
  const chip = ctx.bind(
    el(
      "div",
      "lin-tl-link",
      el(
        "span",
        "lin-tl-link-text card-fade",
        el("span", "lin-tl-link-word", word),
        el("span", "lin-tl-link-title", titleText(target))
      )
    ),
    target
  );
  const [upstream, downstream] = link.edge.map((id) => titleOrId(ctx.get(id), id));
  if (link.relationship) chip.dataset.link = `${upstream} ${link.relationship} ${downstream}`;
  chip.setAttribute(
    "aria-label",
    [word, nodeLabel(target), link.relationship].filter(Boolean).join(", ")
  );
  return chip;
}

const rail = (): HTMLElement => {
  const mark = el("span", "lin-tl-rail");
  mark.setAttribute("aria-hidden", "true");
  return mark;
};

function item(
  ctx: LineageContext<TimelineData>,
  node: LineageNode,
  role: Role | undefined
): HTMLElement {
  const stamp = parseIso(node.iso);
  const text = stamp ? formatTime(stamp) : null;
  const time = text ? el("time", "lin-tl-time", text) : null;
  time?.setAttribute("datetime", node.iso ?? "");

  const record = ctx.node(node, { card: "record", meta: "subtitle", emphasis: role === "focus" });
  if (role === "focus") record.setAttribute("aria-current", "true");
  const links = itemLinks(node.id, ctx.data.edges, ctx.data.items).flatMap((link) => {
    const target = ctx.get(link.id);
    return target ? [linkChip(ctx, target, link)] : [];
  });

  const row = el(
    "li",
    ["lin-tl-item", time && "has-time", role && `role-${role}`].filter(Boolean).join(" "),
    time,
    rail(),
    el("div", "lin-tl-body", record, links.length ? el("div", "lin-tl-links", ...links) : null)
  );
  paintColors(row, node);
  return row;
}

function days(
  ctx: LineageContext<TimelineData>,
  groups: DayGroup[],
  roles: Map<string, Role>
): HTMLElement {
  return el(
    "ol",
    "lin-tl-list",
    ...groups.flatMap(({ day, ids }) => {
      const stamp = parseIso(day);
      const label = stamp ? formatDay(stamp) : "Undated";
      return [
        el("li", "lin-tl-day", rail(), el("h3", "lin-tl-day-head", label)),
        ...ids.flatMap((id) => {
          const node = ctx.get(id);
          return node ? [item(ctx, node, roles.get(id))] : [];
        }),
      ];
    })
  );
}

export default lineageRenderer<TimelineData>("Lineage timeline", (ctx) => {
  const { data } = ctx;
  const roles = focusRoles(data.items, data.edges, data.focus);
  const groups = groupByDay(data.items, (id) => ctx.get(id)?.iso);
  const dated = groups.filter((group) => group.day !== null);
  const undated = groups.filter((group) => group.day === null);
  const timed = data.items.some((id) => parseIso(ctx.get(id)?.iso)?.hour != null);

  return el(
    "div",
    timed ? "lin-timeline has-times" : "lin-timeline",
    dated.length ? days(ctx, dated, roles) : null,
    undated.length ? days(ctx, undated, roles) : null,
    groups.length ? null : el("div", "lin-tl-empty", "No records.")
  );
}, { vertical: true });
