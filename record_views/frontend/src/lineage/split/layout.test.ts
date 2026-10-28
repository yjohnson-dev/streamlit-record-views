import { describe, expect, it } from "vitest";
import { barTracks, formatPercent, numberFormatter, type PartValue, reconcile } from "./layout";

const parts = (...values: (number | null)[]): PartValue[] =>
  values.map((value, i) => ({ id: `p${i + 1}`, value }));

describe("reconcile", () => {
  it("leaves the unallocated total as the remainder", () => {
    const r = reconcile(100, parts(60, 25));
    expect(r.allocated).toBe(85);
    expect(r.remainder).toBe(15);
    expect(r.remainderShare).toBeCloseTo(0.15);
    expect(r.over).toBe(0);
    expect(r.totalShare).toBeNull();
    expect(r.parts.map((p) => p.share)).toEqual([0.6, 0.25]);
    expect(r.parts.map((p) => p.fraction)).toEqual([0.6, 0.25]);
    expect(r.missing).toEqual([]);
  });

  it("has no remainder when the parts cover the total", () => {
    const r = reconcile(16035.5, parts(4200, 1875.5, 9960));
    expect(r.remainder).toBe(0);
    expect(r.remainderShare).toBe(0);
    expect(r.over).toBe(0);
  });

  it("ignores floating-point error", () => {
    const r = reconcile(0.3, parts(0.1, 0.2));
    expect(r.remainder).toBe(0);
    expect(r.over).toBe(0);
    expect(r.totalShare).toBeNull();
  });

  it("reports over-allocation and widens the scale to the parts", () => {
    const r = reconcile(100, parts(70, 50));
    expect(r.over).toBe(20);
    expect(r.remainder).toBe(0);
    expect(r.remainderShare).toBe(0);
    expect(r.totalShare).toBeCloseTo(100 / 120);
    expect(r.parts[0].share).toBeCloseTo(70 / 120);
    expect(r.parts[1].share).toBeCloseTo(50 / 120);
    expect(r.parts[1].fraction).toBe(0.5);
  });

  it("leaves parts without a value out of the bar", () => {
    const r = reconcile(100, parts(40, null, 10));
    expect(r.allocated).toBe(50);
    expect(r.remainder).toBe(50);
    expect(r.parts[1]).toEqual({ id: "p2", value: null, share: 0, fraction: null });
    expect(r.missing).toEqual(["p2"]);
  });

  it("sums the parts without percentages when the total is unknown", () => {
    const r = reconcile(null, parts(30, 20));
    expect(r.allocated).toBe(50);
    expect(r.remainder).toBe(0);
    expect(r.remainderShare).toBe(0);
    expect(r.over).toBe(0);
    expect(r.parts.map((p) => p.fraction)).toEqual([null, null]);
    expect(r.parts.map((p) => p.share)).toEqual([0.6, 0.4]);
  });

  it("treats a zero total as fully over-allocated, without percentages", () => {
    const r = reconcile(0, parts(5));
    expect(r.over).toBe(5);
    expect(r.totalShare).toBe(0);
    expect(r.parts[0].fraction).toBeNull();
  });

  it("draws an empty bar for no parts and an unknown total", () => {
    const r = reconcile(null, []);
    expect(r.allocated).toBe(0);
    expect(r.parts).toEqual([]);
    expect(r.remainderShare).toBe(0);
  });

  it("makes the whole bar the remainder when there are no parts", () => {
    const r = reconcile(40, []);
    expect(r.remainder).toBe(40);
    expect(r.remainderShare).toBe(1);
  });

  it("counts negative values toward the sum but gives them no width", () => {
    const r = reconcile(100, parts(60, -10));
    expect(r.allocated).toBe(50);
    expect(r.remainder).toBe(50);
    expect(r.parts[1].share).toBe(0);
    expect(r.parts[1].fraction).toBe(-0.1);
    expect(r.parts[0].share + r.remainderShare).toBeCloseTo(1);
  });

  it("fills the bar exactly with the parts and the remainder", () => {
    const r = reconcile(250, parts(100, 75, 30));
    const total = r.parts.reduce((sum, p) => sum + p.share, 0) + r.remainderShare;
    expect(total).toBeCloseTo(1);
  });
});

describe("formatPercent", () => {
  const locale = "en-US";

  it("rounds to whole percents from 10% up", () => {
    expect(formatPercent(0.6, locale)).toBe("60%");
    expect(formatPercent(0.3333, locale)).toBe("33%");
    expect(formatPercent(1.2, locale)).toBe("120%");
    expect(formatPercent(0, locale)).toBe("0%");
  });

  it("keeps a decimal below 10%", () => {
    expect(formatPercent(0.0526, locale)).toBe("5.3%");
    expect(formatPercent(0.05, locale)).toBe("5%");
  });

  it("does not round a sliver to zero", () => {
    expect(formatPercent(0.0004, locale)).toBe("<0.1%");
  });
});

describe("numberFormatter", () => {
  const locale = "en-US";

  it("groups whole numbers without decimals", () => {
    const format = numberFormatter([1200, 60, null], locale);
    expect(format(1200)).toBe("1,200");
    expect(format(60)).toBe("60");
  });

  it("gives every figure two decimals when any has a fraction", () => {
    const format = numberFormatter([16035.5, 4200, null], locale);
    expect(format(4200)).toBe("4,200.00");
    expect(format(1875.5)).toBe("1,875.50");
    expect(format(0.1 + 0.2)).toBe("0.30");
  });

  it("keeps a third decimal", () => {
    expect(numberFormatter([0.125], locale)(0.125)).toBe("0.125");
  });
});

describe("barTracks", () => {
  it("gives each segment a flexible track with a minimum width", () => {
    expect(barTracks([0.6, 0.15])).toBe("minmax(2px, 600fr) minmax(2px, 150fr)");
  });
});
