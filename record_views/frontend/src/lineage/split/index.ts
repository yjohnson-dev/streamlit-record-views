import { type Child, el, icon, span } from "../../shared/dom";
import { plural } from "../../shared/format";
import {
  type LineageContext,
  type LineageData,
  type LineageNode,
  lineageRenderer,
  nodeElement,
  nodeLabel,
  paintColors,
  titleOrId,
} from "../../shared/lineage";
import type { Direction } from "../../shared/types";
import {
  barTracks,
  formatPercent,
  numberFormatter,
  type PartShare,
  type Reconciliation,
  reconcile,
} from "./layout";
import "./style.css";

interface SplitData extends LineageData {
  focus: string;
  parts: string[];
  direction: Direction;
  value: string;
  values: Record<string, number | null>;
}

const WORDS = {
  downstream: {
    icon: ":material/call_split:",
    summary: "Splits into",
    allocated: "Allocated",
    balanced: "Fully allocated",
    rest: "Open",
    empty: "No records follow this one.",
  },
  upstream: {
    icon: ":material/call_merge:",
    summary: "Gathers",
    allocated: "Accounted for",
    balanced: "Fully accounted for",
    rest: "Unaccounted",
    empty: "No records precede this one.",
  },
};

/** What the pieces of the view share: the context, the sums, wording, and number format. */
interface Split {
  ctx: LineageContext<SplitData>;
  r: Reconciliation;
  words: (typeof WORDS)[keyof typeof WORDS];
  format: (value: number) => string;
}

const MISSING = "—";

/** A figure with its share of the total, such as "85 (85%)". */
function amount({ r, format }: Split, value: number): HTMLElement {
  return el(
    "span",
    "lin-sp-amount",
    format(value),
    r.total ? el("span", "lin-sp-share", `(${formatPercent(value / r.total)})`) : null
  );
}

function head({ ctx, r, words, format }: Split): HTMLElement {
  const { data } = ctx;
  const focus = ctx.node(ctx.get(data.focus)!, {
    card: "record",
    meta: "subtitle",
    emphasis: true,
  });
  return el(
    "div",
    "lin-sp-head",
    focus,
    el(
      "div",
      "lin-sp-total",
      el("div", "lin-sp-label", data.value),
      el(
        "div",
        r.total === null ? "lin-sp-figure is-missing" : "lin-sp-figure",
        r.total === null ? MISSING : format(r.total)
      ),
      el(
        "div",
        "lin-sp-summary",
        icon(words.icon),
        `${words.summary} ${plural(data.parts.length, "record")}`
      )
    )
  );
}

/** A bar segment linked to its part by hover and click, but not by keyboard. */
function segment(ctx: LineageContext<SplitData>, node: LineageNode): HTMLElement {
  const seg = ctx.bind(el("div", "lin-sp-seg"), node);
  paintColors(seg, node);
  seg.removeAttribute("role");
  seg.removeAttribute("tabindex");
  return seg;
}

function bar({ ctx, r, words, format }: Split): HTMLElement {
  const drawn = r.parts.filter((part) => part.share > 0);
  const segments = drawn.map((part) => segment(ctx, ctx.get(part.id)!));
  const shares = drawn.map((part) => part.share);
  const labels = drawn.map((part) => `${titleOrId(ctx.get(part.id), part.id)} ${format(part.value!)}`);

  if (r.remainder > 0) {
    const rest = el("div", "lin-sp-seg lin-sp-rest");
    rest.title = `${words.rest} ${format(r.remainder)}`;
    segments.push(rest);
    shares.push(r.remainderShare);
    labels.push(rest.title);
  }
  const view = el("div", "lin-sp-bar", ...segments);
  view.style.gridTemplateColumns = barTracks(shares);
  if (r.totalShare !== null) {
    const over = el("div", "lin-sp-over");
    over.style.left = `${r.totalShare * 100}%`;
    view.append(over);
    labels.push(`Over by ${format(r.over)}`);
  }
  view.setAttribute("role", "img");
  view.setAttribute("aria-label", `${ctx.data.value}: ${labels.join(", ")}`);
  return view;
}

function legend(s: Split): HTMLElement {
  const { r, words, format } = s;
  const item = (className: string, ...children: Child[]): HTMLElement =>
    el("span", `lin-sp-legend-item ${className}`.trim(), ...children);
  let end: HTMLElement;
  if (r.over > 0) {
    end = item("is-over", icon(":material/warning:"), `Over by ${format(r.over)}`);
  } else if (r.remainder > 0) {
    end = item("", el("span", "lin-sp-swatch"), `${words.rest} `, amount(s, r.remainder));
  } else {
    end = item("", r.total === null ? "Total unknown" : words.balanced);
  }
  return el("div", "lin-sp-legend", item("", `${words.allocated} `, amount(s, r.allocated)), end);
}

function row({ ctx, format }: Split, part: PartShare): HTMLElement | null {
  const node = ctx.get(part.id);
  if (!node) return null;
  const value = part.value === null ? MISSING : format(part.value);
  const percent = part.fraction === null ? "" : formatPercent(part.fraction);
  const fill = part.share > 0 ? el("div", "lin-sp-fill") : null;
  if (fill) fill.style.width = `${part.share * 100}%`;

  const view = ctx.bind(
    el(
      "div",
      part.value === null ? "lin-sp-row is-missing" : "lin-sp-row",
      el("div", "lin-sp-part", nodeElement(node, { card: "tile" })),
      el("div", "lin-sp-track", fill),
      el("span", "lin-sp-value", value),
      el("span", "lin-sp-percent", percent)
    ),
    node
  );
  paintColors(view, node);
  view.setAttribute(
    "aria-label",
    [nodeLabel(node), `${ctx.data.value} ${value}`, percent].filter(Boolean).join(", ")
  );
  return view;
}

export default lineageRenderer<SplitData>("Lineage split", (ctx) => {
  const { data } = ctx;
  const total = data.values[data.focus] ?? null;
  const r = reconcile(
    total,
    data.parts.map((id) => ({ id, value: data.values[id] ?? null }))
  );
  const s: Split = {
    ctx,
    r,
    words: WORDS[data.direction],
    format: numberFormatter([total, ...r.parts.map((part) => part.value)]),
  };
  const missing = r.missing.length;
  const note = missing
    ? `${plural(missing, "record")} ${missing === 1 ? "has" : "have"} no ${data.value} and ${
        missing === 1 ? "is" : "are"
      } not counted.`
    : null;

  return el(
    "div",
    "lin-split",
    head(s),
    data.parts.length ? el("div", "lin-sp-bar-block", bar(s), legend(s)) : null,
    data.parts.length
      ? el("div", "lin-sp-rows", ...r.parts.map((part) => row(s, part)))
      : span("lin-sp-note", s.words.empty),
    span("lin-sp-note", note)
  );
});
