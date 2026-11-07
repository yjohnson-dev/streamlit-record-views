import type { FieldValue } from "./format";

export type CardSize = "compact" | "small" | "medium" | "large";

/** The card layout that draws a record, from cards/<variant>_card/layout.ts. */
export type CardVariant = "record" | "tile" | "property" | "ledger";

/** What hovering a card shows: the card at a size, nothing, or null for its clipped content. */
export type HoverMode = "small" | "medium" | "large" | "disabled" | null;

/** "dot" keeps only the status dot; "full" also shows its text where it fits. */
export type StatusDisplay = "full" | "dot" | null;

/** A title, subtitle, caption, or headline: [label, value], with a null label for plain text. */
export type Labeled = [string | null, FieldValue];

export type Axis = "horizontal" | "vertical";
export type Direction = "downstream" | "upstream";
export type Orientation = "auto" | Axis;

export interface CardData {
  size: CardSize;
  disabled: boolean;
  recordType: string;
  title: Labeled;
  subtitle?: Labeled | null;
  caption?: Labeled | null;
  color: string;
  icon?: string | null;
  status?: string | null;
  statusColor: string;
  statusBadge: boolean;
  statusDisplay?: StatusDisplay;
  note?: string | null;
  fields: [string, FieldValue][];
  absent: string;
}

/** One line of an itemized ledger card; a line with an id is clickable. */
export interface LedgerItemData {
  label: string;
  amount: number | null;
  quantity: number | null;
  detail: string | null;
  note: string | null;
  id: string | null;
}

/** Payload for cards rendered through shared/view. */
export interface ViewData extends CardData {
  header: "status" | "caption" | null;
  help?: string | null;
  /** Whether the card is mounted with width="content". */
  contentWidth?: boolean;
  /** Null shows the card in full when it is clipped; a size shows `hover`; "disabled" shows nothing. */
  onHover?: HoverMode;
  /** The payload of the card at the onHover size. */
  hover?: ViewData | null;
  layout?: string;
  accounting?: boolean;
  background?: boolean;
  border?: boolean;
  description?: string | null;
  headline?: Labeled | null;
  currency?: string | null;
  /** The lines a ledger card itemizes, and how many more it leaves out. */
  items?: LedgerItemData[] | null;
  moreItems?: number;
  /** The first of the lines left out, which hovering their count lists. */
  hiddenItems?: { label: string; amount: number | null }[] | null;
}

/** Payload for card(): view data that names the variant that draws it, as its hover card does. */
export interface CardPayload extends ViewData {
  variant: CardVariant;
  hover?: CardPayload | null;
}
