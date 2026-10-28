/** A part and its value; null when the record has no number to count. */
export interface PartValue {
  id: string;
  value: number | null;
}

export interface PartShare extends PartValue {
  /** Width in the bar, as a fraction of the bar's scale. */
  share: number;
  /** Fraction of the total, or null without a total or a value. */
  fraction: number | null;
}

export interface Reconciliation {
  total: number | null;
  parts: PartShare[];
  allocated: number;
  remainder: number;
  /** The bar width left after the parts, as a fraction of the scale. */
  remainderShare: number;
  over: number;
  /** Where the total ends in the bar when the parts exceed it. */
  totalShare: number | null;
  /** Ids of the parts left out of the bar for lack of a value. */
  missing: string[];
}

const EPSILON = 1e-9;

/** Treats differences within floating-point error as zero. */
const settle = (difference: number, reference: number): number =>
  Math.abs(difference) <= EPSILON * Math.max(1, Math.abs(reference)) ? 0 : difference;

/** The bar's scale is the total, or the parts' sum when that is larger; negative values take no width. */
export function reconcile(total: number | null, parts: PartValue[]): Reconciliation {
  const counted = parts.flatMap((part) => (part.value === null ? [] : [part.value]));
  const allocated = counted.reduce((sum, value) => sum + value, 0);
  const drawn = counted.reduce((sum, value) => sum + Math.max(0, value), 0);
  const limit = total === null ? null : Math.max(0, total);
  const scale = Math.max(limit ?? 0, drawn);
  const fractionOf = (value: number, whole: number): number => (whole > 0 ? value / whole : 0);

  const gap = limit === null ? 0 : settle(limit - allocated, limit);
  const over = limit !== null && gap < 0 ? -gap : 0;
  return {
    total,
    parts: parts.map((part) => ({
      ...part,
      share: part.value === null ? 0 : fractionOf(Math.max(0, part.value), scale),
      fraction: part.value === null || !limit ? null : part.value / limit,
    })),
    allocated,
    remainder: Math.max(0, gap),
    remainderShare: limit === null ? 0 : fractionOf(Math.max(0, scale - drawn), scale),
    over,
    totalShare: over > 0 && limit !== null ? fractionOf(limit, scale) : null,
    missing: parts.filter((part) => part.value === null).map((part) => part.id),
  };
}

/** Formats a fraction as a percent: whole numbers, one decimal below 10%. */
export function formatPercent(fraction: number, locale?: string): string {
  if (fraction > 0 && fraction < 0.001) return `<${formatPercent(0.001, locale)}`;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: Math.abs(fraction) < 0.1 ? 1 : 0,
  }).format(fraction);
}

export function numberFormatter(
  values: (number | null)[],
  locale?: string
): (value: number) => string {
  const decimals = values.some((value) => value !== null && !Number.isInteger(value));
  const format = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals ? 2 : 0 });
  return (value) => format.format(value);
}

/** Returns grid tracks for bar segments, each at least a sliver wide. */
export function barTracks(shares: number[]): string {
  return shares.map((share) => `minmax(2px, ${share * 1000}fr)`).join(" ");
}
