import { compactLedger } from "../../shared/compact";
import { div, el, icon, identity, span, typeIcon, value } from "../../shared/dom";
import { type FieldValue, accountingParts, formatNumber, plural } from "../../shared/format";
import type { CardData, LedgerItemData, ViewData } from "../../shared/types";
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

function itemRow(
  d: ViewData,
  item: LedgerItemData,
  index: number,
  quantities: boolean
): HTMLElement {
  // Each part keeps to one line and fades when cut off; hovering the line shows it in full.
  const row = el(
    "div",
    "card-item",
    quantities
      ? el(
          "span",
          "card-item-qty card-fade",
          item.quantity === null ? "" : `${formatNumber(item.quantity)} \u00d7`
        )
      : null,
    el(
      "div",
      "card-item-text",
      span("card-item-label card-fade", item.label),
      span("card-item-detail card-fade", item.detail),
      span("card-item-note card-fade", item.note)
    ),
    el("span", "card-figure card-item-amount", item.amount === null ? "" : figure(d, [item.label, item.amount]))
  );
  row.dataset.index = String(index);
  if (item.id !== null) {
    // The card's click handler reads data-item, so a line reports itself instead of the card.
    // Python sends ids only when card() has on_item, so a disabled card's lines stay live then.
    row.classList.add("card-item-open");
    row.dataset.item = item.id;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
  }
  return row;
}

const itemList = (d: ViewData): HTMLElement | null => {
  const items = d.items ?? [];
  if (!items.length) return null;
  const quantities = items.some((item) => item.quantity !== null);
  return div(
    quantities ? "card-items card-items-qty" : "card-items",
    ...items.map((item, index) => itemRow(d, item, index, quantities)),
    d.moreItems ? div("card-items-more", `${plural(d.moreItems, "more line")}`) : null
  );
};

const metaLine = (d: CardData, headItem: HTMLElement | null): HTMLElement | null =>
  div(
    "card-ledger-head",
    div("card-lead card-fade", icon(d.icon), span("", d.recordType)),
    span("card-end", headItem)
  );

// The type and title on the left and the headline figure on the right; they stack when the
// card is too narrow for both.
const top = (d: ViewData, headItem: HTMLElement | null): HTMLElement | null =>
  div("card-ledger-top", div("card-ledger-id", metaLine(d, headItem), identity(d)), headline(d));

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
      itemList(d),
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
      itemList(d),
      footer,
    ];
  }
  return [top(d, headItem), itemList(d), statement(d, items), details(d, other), footer];
}
