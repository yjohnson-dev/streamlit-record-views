import type { FrontendRenderer } from "@streamlit/component-v2-lib";
import {
  createCard,
  div,
  el,
  labeledLine,
  labeledText,
  resolveColor,
  span,
  supportsPopover,
  titleText,
} from "./dom";
import { displayText } from "./format";
import { hoverShows } from "./hover";
import { centerOn, GAP_PX } from "./position";
import type { CardData, CardPayload, CardVariant, ViewData } from "./types";

/** Renders status as a dot, or as a badge that can reduce to its dot. */
export function status(d: CardData): HTMLElement | null {
  if (!d.status) return null;
  const node = el(
    "span",
    d.statusBadge ? "card-status card-status-badge" : "card-status",
    el("span", "card-dot"),
    el("span", "card-status-text", d.status)
  );
  if (d.statusBadge) {
    const color = resolveColor(d.statusColor);
    node.style.setProperty("--card-badge-background", color.background);
    node.style.setProperty("--card-badge-text", color.text);
  }
  return node;
}

/** Returns [header item, footer items] according to d.header. */
export function slots(d: ViewData): [HTMLElement | null, (HTMLElement | null)[]] {
  const caption = labeledLine(d.caption, d, "card-caption");
  const state = status(d);
  if (d.header === "status") return [state, [caption]];
  state?.classList.add("card-fade");
  if (d.header === "caption") return [caption, [state]];
  return [null, [state, caption]];
}

/** The title that leads the row of a small card, fading when the row is narrow. */
export const smallLead = (d: CardData): HTMLElement | null =>
  div("card-lead card-fade", span("card-title", titleText(d)));

/** The caption of a small card, aligned to the right of the row, before the headline and status. */
export const smallCaption = (d: CardData): HTMLElement | null =>
  labeledLine(d.caption, d, "card-caption");

/** The headline and status that end the row of a small card; `headline` is its drawn value. */
export function smallEnd(d: ViewData, headline: HTMLElement | string | null): HTMLElement | null {
  const label = d.headline?.[0] ?? null;
  const lead =
    headline === null
      ? null
      : span(
          "card-headline-item",
          label ? span("card-headline-label", label) : null,
          span("card-figure card-headline-value", headline)
        );
  return span("card-end", lead, status(d));
}

export function ariaLabel(d: ViewData): string {
  const labeled = (item: ViewData["caption"]): string | null =>
    item ? labeledText(item, d.absent, ": ") : null;
  return [
    `${d.recordType} ${titleText(d)}`,
    labeled(d.subtitle),
    d.status && `Status: ${d.status}`,
    labeled(d.caption),
    labeled(d.headline),
    ...d.fields.map(([label, value]) => `${label}: ${displayText(value, d.absent)}`),
    d.note,
  ]
    .filter(Boolean)
    .join(". ");
}

const overflows = (target: Element | null): boolean =>
  target !== null && target.scrollWidth > target.clientWidth + 1;

/** Reduces the status to its dot on each compact card line whose text does not fit. */
export function fitStatus(cards: Iterable<Element>): void {
  const lines = [...cards].flatMap((card) => [
    ...card.querySelectorAll<HTMLElement>(".card-compact-line"),
  ]);
  for (const line of lines) line.classList.remove("card-status-tight");
  // Measure every line before marking any, so layout runs once.
  const tight = lines.map(
    (line) =>
      line.querySelector(".card-status") !== null &&
      [...line.querySelectorAll(":scope > .card-fade")].some(overflows)
  );
  lines.forEach((line, i) => line.classList.toggle("card-status-tight", tight[i]));
}

/** Whether the lead is faded below half of its row. */
const squeezed = (lead: HTMLElement): boolean =>
  overflows(lead) && lead.clientWidth < (lead.parentElement?.clientWidth ?? 0) / 2;

const MIN_SHRINK_PX = 14;

function shrink(target: HTMLElement): void {
  target.style.fontSize = "";
  let size = parseFloat(getComputedStyle(target).fontSize);
  while (overflows(target) && size > MIN_SHRINK_PX) {
    size -= 1;
    target.style.fontSize = `${size}px`;
  }
}

const SQUEEZE_CLASSES = ["card-dot-only", "card-no-caption", "card-no-headline"];

function fit(node: HTMLElement, d: ViewData): void {
  node.classList.remove(...SQUEEZE_CLASSES, "card-stacked");
  if (d.size === "compact") fitStatus([node]);
  // A narrow row gives up its parts in order: the status text first, then the caption, then the
  // headline. A small card does so as soon as its title or caption is clipped; the header of a
  // larger card does so once its lead is below half the row.
  const lead = node.querySelector<HTMLElement>(".card-lead");
  const caption = node.querySelector<HTMLElement>(".card-caption");
  const clipped = (): boolean => overflows(lead) || overflows(caption);
  if (lead && d.size === "small") {
    if (clipped()) {
      node.classList.add("card-dot-only");
      if (clipped()) {
        node.classList.add("card-no-caption");
        if (overflows(lead)) node.classList.add("card-no-headline");
      }
    }
  } else if (lead && squeezed(lead)) {
    node.classList.add("card-dot-only");
    if (squeezed(lead)) node.classList.add("card-no-caption");
  }
  if (Array.from(node.querySelectorAll(".card-table > div")).some(overflows)) {
    node.classList.add("card-stacked");
  }
  for (const target of node.querySelectorAll<HTMLElement>(".card-shrink")) {
    shrink(target);
  }
  for (const target of node.querySelectorAll<HTMLElement>(".card-fade")) {
    target.classList.toggle("card-overflowing", overflows(target));
  }
  for (const target of node.querySelectorAll<HTMLElement>(".card-clamp")) {
    target.classList.toggle(
      "card-overflowing",
      target.scrollHeight > target.clientHeight + 1
    );
  }
  const cut =
    node.querySelector(".card-overflowing") !== null ||
    SQUEEZE_CLASSES.some((name) => node.classList.contains(name));
  node.classList.toggle("card-clipped", cut);
}

export type Cleanup = () => void;

/** Refits the card whenever it resizes or late-loading fonts arrive. */
function trackFit(node: HTMLElement, d: ViewData): Cleanup {
  const observer = new ResizeObserver(() => fit(node, d));
  observer.observe(node);
  void document.fonts?.ready.then(() => {
    if (node.isConnected) fit(node, d);
  });
  return () => observer.disconnect();
}

const HOVER_DELAY_MS = 300;
let tooltipCount = 0;

/** Shows a top-layer popover after a delay while the card is hovered or focused. */
function onHover(
  card: HTMLElement,
  pop: HTMLElement,
  position: () => void,
  enabled: () => boolean = () => true,
  onHide: () => void = () => {}
): Cleanup {
  pop.setAttribute("popover", "manual");
  let timer: number | undefined;
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") hide();
  };
  const hide = (): void => {
    window.clearTimeout(timer);
    window.removeEventListener("scroll", hide, true);
    document.removeEventListener("keydown", onKey);
    if (pop.matches(":popover-open")) pop.hidePopover();
    onHide();
  };
  const show = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!pop.isConnected || !enabled()) return;
      pop.showPopover();
      position();
      window.addEventListener("scroll", hide, true);
      document.addEventListener("keydown", onKey);
    }, HOVER_DELAY_MS);
  };
  card.addEventListener("mouseenter", show);
  card.addEventListener("mouseleave", hide);
  card.addEventListener("focus", show);
  card.addEventListener("blur", hide);
  return () => {
    hide();
    card.removeEventListener("mouseenter", show);
    card.removeEventListener("mouseleave", hide);
    card.removeEventListener("focus", show);
    card.removeEventListener("blur", hide);
  };
}

/** Builds a tooltip placed above the card, or below it when there is no room. */
function tooltip(card: HTMLElement, text: string): [HTMLElement, Cleanup] {
  const tip = el("div", "card-tooltip", text);
  tip.id = `card-tooltip-${++tooltipCount}`;
  tip.setAttribute("role", "tooltip");
  card.setAttribute("aria-describedby", tip.id);
  const cleanup = onHover(card, tip, () => {
    const anchor = card.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const above = anchor.top - box.height - GAP_PX;
    tip.style.top = `${above >= GAP_PX ? above : anchor.bottom + GAP_PX}px`;
    tip.style.left = `${centerOn(anchor.left, anchor.width, box.width, window.innerWidth)}px`;
  });
  return [tip, cleanup];
}

/** Notes, under each clamped text, that it is still cut off in the expansion. */
function markTruncated(copy: HTMLElement): void {
  for (const note of copy.querySelectorAll(".card-truncated")) note.remove();
  for (const clamped of copy.querySelectorAll(".card-clamp.card-overflowing")) {
    clamped.after(el("div", "card-truncated", "Truncated"));
  }
}

/** Builds, on first show, the card drawn over it: its full content when clipped, or its hover size. */
function expansion(
  card: HTMLElement,
  d: ViewData,
  make: () => HTMLElement
): [HTMLElement, Cleanup] {
  const pop = el("div", "card-expansion");
  pop.setAttribute("aria-hidden", "true");
  // A hover size draws another payload, so the copy refits with that payload's dates.
  const shown = d.hover ?? d;
  let copy: HTMLElement | null = null;
  const cleanup = onHover(
    card,
    pop,
    () => {
      if (!copy) {
        copy = make();
        copy.tabIndex = -1;
        pop.append(copy);
      }
      const anchor = card.getBoundingClientRect();
      pop.style.minWidth = `${anchor.width}px`;
      fit(copy, shown);
      markTruncated(copy);
      const box = pop.getBoundingClientRect();
      pop.style.left = `${centerOn(anchor.left, anchor.width, box.width, window.innerWidth)}px`;
      pop.style.top = `${centerOn(anchor.top, anchor.height, box.height, window.innerHeight)}px`;
      // The card hides only beneath a copy that covers it.
      card.classList.toggle(
        "card-expanded",
        box.width >= anchor.width && box.height >= anchor.height
      );
    },
    () => hoverShows(d.onHover, card.classList.contains("card-clipped")) !== "nothing",
    () => card.classList.remove("card-expanded")
  );
  return [pop, cleanup];
}

function buildCard(
  d: ViewData,
  variant: string,
  render: (d: ViewData) => (HTMLElement | null)[]
): HTMLElement {
  const card = createCard(d, variant, render(d));
  card.classList.toggle("card-filled", Boolean(d.background));
  card.classList.toggle("card-bordered", Boolean(d.border));
  return card;
}

/** Builds a non-interactive card that refits to its width, for embedding. */
export function cardView(
  d: ViewData,
  variant: string,
  render: (d: ViewData) => (HTMLElement | null)[]
): [HTMLElement, Cleanup] {
  const card = buildCard({ ...d, disabled: true }, variant, render);
  return [card, trackFit(card, d)];
}

/** Marks single-line text that overflows so it fades instead of clipping. */
export function markFades(root: ParentNode): void {
  const targets = [...root.querySelectorAll<HTMLElement>(".card-fade")];
  // Measure every target before marking any, so layout runs once.
  const overflowing = targets.map(overflows);
  targets.forEach((target, i) => target.classList.toggle("card-overflowing", overflowing[i]));
}

const cleanups = new WeakMap<Node, Cleanup>();

/** Creates the CCv2 card renderer, which draws each card with the layout of its payload's variant. */
export function viewRenderer(
  layouts: Record<CardVariant, (d: ViewData) => (HTMLElement | null)[]>
): FrontendRenderer<Record<string, unknown>, CardPayload> {
  return ({ data, parentElement, setTriggerValue }) => {
    const root = parentElement.querySelector(".card-root") ?? parentElement;
    if (!root || !data) return;
    cleanups.get(root)?.();
    if (root instanceof HTMLElement) {
      root.classList.toggle("card-root--content", Boolean(data.contentWidth));
    }

    const node = buildCard(data, data.variant, layouts[data.variant]);
    node.setAttribute("aria-label", ariaLabel(data));
    if (data.disabled) {
      node.setAttribute("role", "group");
      node.setAttribute("aria-disabled", "true");
    } else {
      node.setAttribute("role", "button");
      node.tabIndex = 0;
      node.onclick = () => setTriggerValue("click", true);
      node.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setTriggerValue("click", true);
        }
      };
    }
    root.replaceChildren(node);

    const disposers: Cleanup[] = [trackFit(node, data)];
    if (supportsPopover && data.onHover !== "disabled") {
      const hover = data.hover ? { ...data.hover, disabled: data.disabled } : data;
      const [pop, cleanup] = expansion(node, data, () =>
        buildCard(hover, hover.variant, layouts[hover.variant])
      );
      root.append(pop);
      disposers.push(cleanup);
    }
    if (data.help) {
      if (supportsPopover) {
        const [tip, cleanup] = tooltip(node, data.help);
        root.append(tip);
        disposers.push(cleanup);
      } else {
        node.title = data.help;
      }
    }
    const cleanup = (): void => {
      for (const dispose of disposers) dispose();
      cleanups.delete(root);
    };
    cleanups.set(root, cleanup);
    return cleanup;
  };
}
