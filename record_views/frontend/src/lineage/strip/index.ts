import { el } from "../../shared/dom";
import {
  type LineageContext,
  type LineageData,
  type LineageEntity,
  lineageRenderer,
  variantOf,
} from "../../shared/lineage";
import type { ViewData } from "../../shared/types";
import { LAYOUTS } from "../../shared/variants";
import { cardView } from "../../shared/view";
import "./style.css";

interface StripData extends LineageData {
  focus: string;
  upstream: string[][];
  downstream: string[][];
  related: string[];
  sources: LineageEntity[];
  targets: LineageEntity[];
  focusCard: ViewData | null;
}

const entities = (label: string, items: LineageEntity[]): HTMLElement | null =>
  items.length
    ? el(
        "div",
        "lin-strip-entities",
        el("div", "lin-strip-caption", label),
        ...items.map((entity) =>
          el(
            "div",
            "lin-entity",
            entity.type ? el("span", "lin-entity-type", entity.type) : null,
            el("span", "lin-entity-name card-fade", entity.name)
          )
        )
      )
    : null;

function column(
  ctx: LineageContext<StripData>,
  ids: string[],
  caption: string | null
): HTMLElement {
  return el(
    "div",
    "lin-strip-col",
    caption ? el("div", "lin-strip-caption", caption) : null,
    ...ctx.nodes(ids).map((node) => ctx.node(node, { card: "record", meta: "caption" }))
  );
}

export default lineageRenderer<StripData>("Lineage strip", (ctx) => {
  const { data } = ctx;
  const focus = ctx.get(data.focus)!;

  let center: HTMLElement;
  if (data.focusCard) {
    const variant = variantOf(data);
    const [card, dispose] = cardView(data.focusCard, variant, LAYOUTS[variant]);
    ctx.cleanup(dispose);
    center = ctx.bind(card, focus);
  } else {
    center = ctx.node(focus, { card: "record", emphasis: true, meta: "subtitle" });
  }

  const related = ctx.nodes(data.related);
  const focusColumn = el(
    "div",
    "lin-strip-focus",
    center,
    related.length
      ? el(
          "div",
          "lin-strip-related",
          el("div", "lin-strip-caption", "Related"),
          el(
            "div",
            "lin-strip-related-list",
            ...related.map((node) => ctx.node(node, { card: "tile" }))
          )
        )
      : null
  );

  const upstream = [...data.upstream]
    .reverse()
    .map((ids, i, all) => column(ctx, ids, i === all.length - 1 ? "Upstream" : null));
  const downstream = data.downstream.map((ids, i) =>
    column(ctx, ids, i === 0 ? "Downstream" : null)
  );

  const strip = el(
    "div",
    "lin-strip",
    entities("From", data.sources),
    ...upstream,
    focusColumn,
    ...downstream,
    entities("To", data.targets)
  );
  ctx.connect(strip);
  ctx.onResize(() => {
    strip.classList.remove("is-compact", "is-stacked");
    for (const tier of ["is-compact", "is-stacked"]) {
      if (strip.scrollWidth <= strip.clientWidth + 1) break;
      strip.classList.add(tier);
    }
  });
  return strip;
}, { smallLabel: true });
