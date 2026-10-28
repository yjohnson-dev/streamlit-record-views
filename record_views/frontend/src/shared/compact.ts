import { avatar, div, el, icon, labeledLine, titleText, value } from "./dom";
import { type FieldValue, formatNumber } from "./format";
import type { CardData, CardVariant, ViewData } from "./types";
import { status } from "./view";

/** Card data for compact layouts; the options a variant does not use may be absent. */
export type Compact = CardData & Partial<Pick<ViewData, "header" | "headline" | "currency">>;

/** Whether the status sits on the first line; header="date" or None moves it to the last. */
const statusFirst = (d: Compact): boolean => d.header === undefined || d.header === "status";

function fadingStatus(d: Compact): HTMLElement | null {
  const state = status(d);
  state?.classList.add("card-fade");
  return state;
}

/** A labeled value for a compact card's last line, such as "Amount 8,200". */
export function compactField(
  label: string,
  content: HTMLElement | string
): HTMLElement {
  return el(
    "span",
    "card-compact-field",
    el("span", "card-compact-label", label),
    el("span", "card-compact-value", content)
  );
}

export function compactLines(
  d: Compact,
  last: HTMLElement | string | null | undefined
): (HTMLElement | null)[] {
  const first = statusFirst(d);
  const lastStatus = first ? null : fadingStatus(d);
  return [
    el(
      "div",
      "card-compact-head card-compact-line",
      icon(d.icon),
      el("span", "card-type card-fade", d.recordType),
      first ? fadingStatus(d) : null
    ),
    div("card-title card-fade", titleText(d)),
    last || lastStatus
      ? el(
          "div",
          "card-compact-meta card-compact-line",
          lastStatus,
          last ? el("span", "card-compact-last card-fade", last) : null
        )
      : null,
  ];
}

/** The headline on a compact card's last line: "Amount 8,200" when labeled, otherwise its value. */
function compactHeadline(d: Compact, content?: HTMLElement | string): HTMLElement | null {
  const lead = d.headline;
  if (!lead) return null;
  const shown = content ?? value(d, lead);
  return lead[0] ? compactField(lead[0], shown) : el("span", "card-compact-value", shown);
}

/** The last line of a compact card: the headline, else the caption, else the subtitle. */
const compactLast = (d: Compact, lead: HTMLElement | null): HTMLElement | null =>
  lead ?? labeledLine(d.caption, d, "card-compact-text") ?? labeledLine(d.subtitle, d, "card-compact-text");

export const compactRecord = (d: Compact): (HTMLElement | null)[] =>
  compactLines(d, compactLast(d, compactHeadline(d)));

export const compactTile = (d: Compact): (HTMLElement | null)[] => [
  avatar(d),
  el("span", "card-title card-fade", titleText(d)),
  d.status ? el("span", "card-dot") : null,
];

/** The headline, else the first field, else the caption or subtitle. */
export function compactProperty(d: Compact): (HTMLElement | null)[] {
  const first = d.fields[0] as [string, FieldValue] | undefined;
  const lead = compactHeadline(d) ?? (first ? compactField(first[0], value(d, first)) : null);
  return compactLines(d, compactLast(d, lead));
}

/** The headline figure on the last line, such as "Amount $8,200.00". */
export function compactLedger(d: Compact): (HTMLElement | null)[] {
  const lead = d.headline;
  const figure =
    lead && typeof lead[1] === "number"
      ? formatNumber(lead[1], { currency: d.currency })
      : undefined;
  return compactLines(d, compactLast(d, compactHeadline(d, figure)));
}

/** The compact layout of each card variant. */
export const COMPACT: Record<CardVariant, (d: Compact) => (HTMLElement | null)[]> = {
  record: compactRecord,
  tile: compactTile,
  property: compactProperty,
  ledger: compactLedger,
};
