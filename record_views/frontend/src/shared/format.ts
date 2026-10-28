/** A field value as sent by Python: text, a number, or missing. */
export type FieldValue = string | number | null;

export interface NumberOptions {
  currency?: string | null;
  locale?: string;
}

const formatter = ({ currency, locale }: NumberOptions): Intl.NumberFormat =>
  new Intl.NumberFormat(locale, currency ? { style: "currency", currency } : {});

export const formatNumber = (value: number, options: NumberOptions = {}): string =>
  formatter(options).format(value);

/** A number split into the columns of accounting presentation. */
export interface Amount {
  symbol: string;
  amount: string;
  negative: boolean;
  decimal: boolean;
}

const AMOUNT_PARTS = new Set(["integer", "group", "decimal", "fraction"]);

export function accountingParts(value: number, options: NumberOptions = {}): Amount {
  const parts = formatter(options).formatToParts(Math.abs(value));
  return {
    symbol: parts
      .filter((part) => part.type === "currency")
      .map((part) => part.value)
      .join(""),
    amount: parts
      .filter((part) => AMOUNT_PARTS.has(part.type))
      .map((part) => part.value)
      .join(""),
    negative: value < 0,
    decimal: parts.some((part) => part.type === "fraction"),
  };
}

/** Counts things with a plural noun, such as "3 records". */
export const plural = (count: number, word: string): string =>
  `${formatNumber(count)} ${word}${count === 1 ? "" : "s"}`;

export const displayText = (value: FieldValue, absent: string): string =>
  value === null ? absent : typeof value === "number" ? formatNumber(value) : value;
