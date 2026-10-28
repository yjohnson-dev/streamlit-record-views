import { describe, expect, it } from "vitest";
import { accountingParts, formatNumber } from "./format";

const locale = "en-US";

describe("formatNumber", () => {
  it("groups plain numbers", () => {
    expect(formatNumber(12480, { locale })).toBe("12,480");
    expect(formatNumber(4.25, { locale })).toBe("4.25");
  });

  it("formats currency", () => {
    expect(formatNumber(4980, { currency: "USD", locale })).toBe("$4,980.00");
    expect(formatNumber(-520, { currency: "USD", locale })).toBe("-$520.00");
  });
});

describe("accountingParts", () => {
  it("splits symbol and amount", () => {
    expect(accountingParts(12120, { currency: "USD", locale })).toEqual({
      symbol: "$",
      amount: "12,120.00",
      negative: false,
      decimal: true,
    });
  });

  it("drops the sign from negatives", () => {
    expect(accountingParts(-520, { currency: "EUR", locale })).toEqual({
      symbol: "€",
      amount: "520.00",
      negative: true,
      decimal: true,
    });
  });

  it("has no symbol or decimals for plain integers", () => {
    expect(accountingParts(1200, { locale })).toEqual({
      symbol: "",
      amount: "1,200",
      negative: false,
      decimal: false,
    });
  });
});
