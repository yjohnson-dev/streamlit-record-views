import { compactProperty } from "../../shared/compact";
import { div, icon, identity, span, typeIcon, value } from "../../shared/dom";
import type { CardData, ViewData } from "../../shared/types";
import { slots, smallCaption, smallEnd, smallLead } from "../../shared/view";

const specs = (d: CardData): HTMLElement | null =>
  div(
    "card-specs",
    ...d.fields.map((field) =>
      div(
        "card-spec",
        div("card-spec-label", field[0]),
        div("card-spec-value card-clamp", value(d, field))
      )
    )
  );

const metaLine = (d: CardData, headItem: HTMLElement | null): HTMLElement =>
  div(
    "card-meta-line",
    div("card-lead card-fade", icon(d.icon), span("", d.recordType)),
    span("card-end", headItem)
  ) as HTMLElement;

const chipLine = (d: CardData, headItem: HTMLElement | null): HTMLElement =>
  div(
    "card-chip-line",
    div(
      "card-lead card-fade",
      span("card-chip-type", icon(d.icon), span("", d.recordType))
    ),
    span("card-end", headItem)
  ) as HTMLElement;

const description = (d: ViewData): HTMLElement | null =>
  div("card-description card-clamp", d.description);

const footer = (d: CardData, items: (HTMLElement | null)[]): HTMLElement | null =>
  div("card-property-foot", ...items, span("", d.note));

export function renderPropertyCard(d: ViewData): (HTMLElement | null)[] {
  if (d.size === "compact") return compactProperty(d);
  const [headItem, footItems] = slots(d);
  if (d.size === "small") {
    return [
      typeIcon(d),
      smallLead(d),
      smallCaption(d),
      smallEnd(d, d.headline ? value(d, d.headline) : null),
    ];
  }
  if (d.layout === "chip") {
    return [
      chipLine(d, headItem),
      identity(d),
      description(d),
      specs(d),
      footer(d, footItems),
    ];
  }
  if (d.layout === "split") {
    return [
      div(
        "card-split",
        div(
          "card-split-side",
          identity(d),
          metaLine(d, headItem),
          description(d)
        ),
        specs(d)
      ),
      footer(d, footItems),
    ];
  }
  return [
    identity(d),
    metaLine(d, headItem),
    description(d),
    specs(d),
    footer(d, footItems),
  ];
}
