import { compactTile } from "../../shared/compact";
import { avatar, div, labeledLine, span, table, titleText, value } from "../../shared/dom";
import type { CardData, ViewData } from "../../shared/types";
import { slots, smallCaption, smallEnd, smallLead } from "../../shared/view";

const facts = (d: CardData): HTMLElement | null =>
  div(
    "card-tile-facts card-fade",
    ...d.fields.map((field) =>
      span(
        "card-tile-fact",
        span("card-tile-label", field[0]),
        span("", value(d, field))
      )
    )
  );

export function renderTileCard(d: ViewData): (HTMLElement | null)[] {
  if (d.size === "compact") return compactTile(d);
  if (d.size === "small") {
    return [
      avatar(d),
      div(
        "card-tile-line",
        smallLead(d),
        smallCaption(d),
        smallEnd(d, d.headline ? value(d, d.headline) : null)
      ),
    ];
  }
  const [headItem, footItems] = slots(d);
  const titleLine = div(
    "card-tile-line",
    div("card-lead card-fade", span("card-title", titleText(d))),
    span("card-end", headItem)
  );

  const large = d.size === "large";
  return [
    avatar(d),
    div(
      "card-tile-body",
      titleLine,
      div(
        "card-tile-meta card-fade",
        span("card-tile-type", d.recordType),
        labeledLine(d.subtitle, d, "card-tile-subtitle")
      ),
      large ? table(d) : facts(d),
      div("card-tile-foot", ...footItems, large ? span("card-tile-note", d.note) : null)
    ),
  ];
}
