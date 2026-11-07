import { el, span, supportsPopover } from "./dom";
import { formatNumber } from "./format";
import { createTooltip } from "./tooltip";
import type { LedgerItemData, ViewData } from "./types";
import type { Cleanup } from "./view";

/** The most hidden lines a "more lines" tooltip lists before it counts the rest. */
const LISTED = 12;

const money = (d: ViewData, amount: number | null): string =>
  amount === null ? "" : formatNumber(amount, { currency: d.currency });

function lineContent(d: ViewData, item: LedgerItemData): HTMLElement[] {
  const quantity = item.quantity === null ? "" : `${formatNumber(item.quantity)} × `;
  return [
    el("div", "card-item-tip-title", `${quantity}${item.label}`),
    ...[item.detail, item.note].filter(Boolean).map((text) => el("div", "card-item-tip-muted", text)),
    ...(item.amount === null ? [] : [el("div", "card-item-tip-amount", money(d, item.amount))]),
  ];
}

function hiddenContent(d: ViewData): HTMLElement[] {
  const hidden = d.hiddenItems ?? [];
  const rest = (d.moreItems ?? 0) - Math.min(hidden.length, LISTED);
  return [
    ...hidden.slice(0, LISTED).map((item) =>
      el("div", "card-item-tip-row", span("card-item-tip-label", item.label), span("", money(d, item.amount)))
    ),
    ...(rest > 0 ? [el("div", "card-item-tip-muted", `and ${formatNumber(rest)} more`)] : []),
  ];
}

/**
 * Shows a line's full text beside the pointer when the line is cut off, and lists the lines left
 * out when the pointer is on the count of them.
 */
export function itemTips(root: ParentNode, card: HTMLElement, d: ViewData): Cleanup {
  if (!supportsPopover || !d.items?.length) return () => {};
  const tip = createTooltip();
  tip.element.classList.add("card-item-tip");
  root.append(tip.element);

  const content = (target: EventTarget | null): HTMLElement[] | null => {
    if (!(target instanceof Element)) return null;
    const row = target.closest<HTMLElement>(".card-item");
    if (row) {
      const item = d.items?.[Number(row.dataset.index)];
      return item && row.querySelector(".card-overflowing") ? lineContent(d, item) : null;
    }
    return target.closest(".card-items-more") && d.moreItems ? hiddenContent(d) : null;
  };
  const show = (event: MouseEvent): void => {
    const shown = content(event.target);
    if (shown) tip.show(shown, event.clientX, event.clientY);
    else tip.hide();
  };
  const move = (event: MouseEvent): void => {
    if (content(event.target)) tip.move(event.clientX, event.clientY);
    else tip.hide();
  };
  const list = card.querySelector(".card-items");
  list?.addEventListener("mouseover", show as EventListener);
  list?.addEventListener("mousemove", move as EventListener);
  list?.addEventListener("mouseleave", tip.hide);
  window.addEventListener("scroll", tip.hide, true);
  return () => {
    list?.removeEventListener("mouseover", show as EventListener);
    list?.removeEventListener("mousemove", move as EventListener);
    list?.removeEventListener("mouseleave", tip.hide);
    window.removeEventListener("scroll", tip.hide, true);
    tip.hide();
    tip.element.remove();
  };
}
