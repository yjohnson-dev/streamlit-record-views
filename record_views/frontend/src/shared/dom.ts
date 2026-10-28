import { displayText, type FieldValue, formatNumber } from "./format";
import type { CardData, Labeled } from "./types";

export type Child = HTMLElement | string | number | null | undefined | false;

export const SVG_NS = "http://www.w3.org/2000/svg";

export const supportsPopover =
  typeof HTMLElement !== "undefined" &&
  typeof HTMLElement.prototype.showPopover === "function";

export const remPx = (): number =>
  parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

export const el = (
  tag: string,
  className?: string,
  ...children: Child[]
): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) {
    if (child != null && child !== "" && child !== false) {
      node.append(typeof child === "object" ? child : String(child));
    }
  }
  return node;
};

export const part = (
  tag: string,
  className?: string,
  ...children: Child[]
): HTMLElement | null =>
  children.some((child) => child != null && child !== "" && child !== false)
    ? el(tag, className, ...children)
    : null;

export const div = (className?: string, ...children: Child[]): HTMLElement | null =>
  part("div", className, ...children);

export const span = (className?: string, ...children: Child[]): HTMLElement | null =>
  part("span", className, ...children);

export const icon = (value?: string | null): HTMLElement | null => {
  if (!value) return null;
  const symbol = value.startsWith(":material/") && value.endsWith(":");
  const node = symbol
    ? el("span", "card-icon card-symbol", value.slice(10, -1))
    : el("span", "card-icon", value);
  node.setAttribute("aria-hidden", "true");
  return node;
};

export const value = (
  d: CardData,
  [, raw]: [unknown, FieldValue]
): HTMLElement | string =>
  raw === null
    ? el("span", "card-missing", d.absent)
    : typeof raw === "number"
      ? formatNumber(raw)
      : raw;

export interface ResolvedColor {
  accent: string;
  background: string;
  text: string;
}

export function resolveColor(value: string): ResolvedColor {
  if (/^(#|(rgba?|hsla?|oklch)\()/i.test(value)) {
    return {
      accent: value,
      background: `color-mix(in srgb, ${value} 15%, transparent)`,
      // Blends toward the theme text color so custom colors stay legible in both themes.
      text: `color-mix(in srgb, ${value} 70%, var(--st-text-color))`,
    };
  }

  return {
    accent: `var(--st-${value}-color)`,
    background: `var(--st-${value}-background-color)`,
    text: `var(--st-${value}-text-color)`,
  };
}

export const typeIcon = (d: CardData): HTMLElement | null =>
  span("card-type-icon", icon(d.icon));

export const avatar = (d: CardData): HTMLElement | null =>
  span("card-avatar", icon(d.icon));

/** The text of a labeled value: "Sales Order 1234567" with a space, or "Order Date: 2026-09-23" with ": ". */
export const labeledText = (item: Labeled, absent: string, separator: string): string => {
  const text = displayText(item[1], absent);
  return item[0] ? `${item[0]}${separator}${text}` : text;
};

/** The title as one text, so that a label and its value read as one thing. */
export const titleText = (d: Pick<CardData, "title" | "absent">): string =>
  labeledText(d.title, d.absent, " ");

/** A subtitle or caption: its value, with a bold label and a colon before it when it has one. */
export function labeledLine(
  item: Labeled | null | undefined,
  d: CardData,
  className: string,
  tag = "span"
): HTMLElement | null {
  if (!item) return null;
  const [label] = item;
  const text = displayText(item[1], d.absent);
  return label
    ? el(tag, className, el("span", "card-key", `${label}:`), " ", text)
    : el(tag, className, text);
}

export const identity = (d: CardData): HTMLElement | null =>
  div(
    "card-stack",
    div("card-title card-fade", titleText(d)),
    labeledLine(d.subtitle, d, "card-muted card-fade", "div")
  );

export const table = (d: CardData): HTMLElement | null =>
  div(
    "card-table",
    ...d.fields.flatMap((field) => [
      el("div", "", field[0]),
      el("div", "", value(d, field)),
    ])
  );

export const createCard = (
  d: CardData,
  variant: string,
  children: (HTMLElement | null)[]
): HTMLElement => {
  const classes = `card card-${d.size} card-${variant}`;
  const node = el("div", classes, ...children);

  const accent = resolveColor(d.color);
  node.style.setProperty("--card-accent", accent.accent);
  node.style.setProperty("--card-accent-background", accent.background);
  node.style.setProperty("--card-accent-text", accent.text);

  const statusCol = resolveColor(d.statusColor);
  node.style.setProperty("--card-status", statusCol.accent);

  if (d.statusDisplay === "dot") node.classList.add("card-status-dot");
  if (!d.disabled) node.classList.add("card-open");
  return node;
};
