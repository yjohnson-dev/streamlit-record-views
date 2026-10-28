import { compactRecord } from "../../shared/compact";
import { div, icon, identity, span, table, typeIcon, value } from "../../shared/dom";
import type { CardData, ViewData } from "../../shared/types";
import { slots, smallCaption, smallEnd, smallLead } from "../../shared/view";

const footer = (d: CardData, items: (HTMLElement | null)[]): HTMLElement | null =>
  div("card-section-foot card-muted", ...items, span("", d.note));

export function renderRecordCard(d: ViewData): (HTMLElement | null)[] {
  if (d.size === "compact") return compactRecord(d);
  const [headItem, footItems] = slots(d);
  if (d.size === "small") {
    return [
      div("card-section-head", typeIcon(d)),
      div(
        "card-small-main",
        smallLead(d),
        smallCaption(d),
        smallEnd(d, d.headline ? value(d, d.headline) : null)
      ),
    ];
  }
  const head = div(
    "card-section-head",
    div(
      "card-head-lead card-lead card-fade",
      icon(d.icon),
      span("card-type", d.recordType)
    ),
    span("card-end", headItem)
  );
  return [
    head,
    div("card-section-body", identity(d), table(d)),
    footer(d, footItems),
  ];
}
