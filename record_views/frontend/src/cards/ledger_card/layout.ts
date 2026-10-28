import { compactLedger } from "../../shared/compact";
import { div, el, icon, identity, span, typeIcon, value } from "../../shared/dom";
import { type FieldValue, accountingParts, formatNumber } from "../../shared/format";
import type { CardData, ViewData } from "../../shared/types";
import { slots, smallCaption, smallEnd, smallLead } from "../../shared/view";

type Field = [string, FieldValue];

function partition(d: ViewData): [Field[], Field[]] {
  const items: Field[] = [];
  const details: Field[] = [];
  for (const field of d.fields) {
    (typeof field[1] === "number" ? items : details).push(field);
  }
  return [items, details];
}

function figure(d: ViewData, field: [unknown, FieldValue]): HTMLElement | string {
  const raw = field[1];
  if (typeof raw !== "number") return value(d, field);
  const options = { currency: d.currency };
  if (!d.accounting) return formatNumber(raw, options);
  const parts = accountingParts(raw, options);
  const classes = ["card-acct-amount"];
  if (parts.decimal) classes.push("card-acct-decimal");
  if (parts.negative) classes.push("card-acct-negative");
  return el(
    "span",
    "card-acct",
    el("span", "card-acct-symbol", parts.symbol),
    el("span", classes.join(" "), parts.negative ? `(${parts.amount})` : parts.amount)
  );
}

const withAccounting = (d: ViewData, className: string): string =>
  d.accounting ? `${className} card-accounting` : className;

const headline = (d: ViewData): HTMLElement | null =>
  d.headline
    ? div(
        withAccounting(d, "card-headline"),
        div("card-headline-label", d.headline[0]),
        div("card-figure card-headline-figure card-shrink card-fade", figure(d, d.headline))
      )
    : null;

const leaderRow = (field: Field, content: HTMLElement | string): HTMLElement | null =>
  div(
    "card-statement-row",
    span(
      "card-statement-key",
      span("card-statement-label card-fade", field[0]),
      span("card-leader", " ")
    ),
    span("card-figure", content)
  );

const statement = (d: ViewData, rows: Field[]): HTMLElement | null =>
  div(
    withAccounting(d, "card-statement"),
    ...rows.map((field) => leaderRow(field, figure(d, field)))
  );

const stats = (d: ViewData, rows: Field[]): HTMLElement | null =>
  div(
    withAccounting(d, "card-stats"),
    ...rows.map((field) =>
      div(
        "card-stat",
        div("card-stat-label", field[0]),
        div("card-figure", figure(d, field))
      )
    )
  );

const details = (d: ViewData, rows: Field[]): HTMLElement | null =>
  div("card-details", ...rows.map((field) => leaderRow(field, value(d, field))));

const metaLine = (d: CardData, headItem: HTMLElement | null): HTMLElement | null =>
  div(
    "card-ledger-head",
    div("card-lead card-fade", icon(d.icon), span("", d.recordType)),
    span("card-end", headItem)
  );

export function renderLedgerCard(d: ViewData): (HTMLElement | null)[] {
  if (d.size === "compact") return compactLedger(d);
  const [headItem, footItems] = slots(d);
  if (d.size === "small") {
    return [
      typeIcon(d),
      smallLead(d),
      smallCaption(d),
      smallEnd(d, d.headline ? figure(d, d.headline) : null),
    ];
  }
  const [items, other] = partition(d);
  const footer = div("card-ledger-foot", ...footItems, span("", d.note));
  if (d.layout === "metric") {
    return [
      metaLine(d, headItem),
      headline(d),
      identity(d),
      stats(d, items),
      details(d, other),
      footer,
    ];
  }
  if (d.layout === "split") {
    return [
      metaLine(d, headItem),
      div(
        "card-split",
        div("card-split-side", identity(d), headline(d)),
        div("card-split-side", statement(d, items), details(d, other))
      ),
      footer,
    ];
  }
  return [
    metaLine(d, headItem),
    identity(d),
    headline(d),
    statement(d, items),
    details(d, other),
    footer,
  ];
}
