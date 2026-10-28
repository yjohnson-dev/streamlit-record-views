import { describe, expect, it } from "vitest";
import { centerOn, fitsColumns, placePopover } from "./position";

describe("centerOn", () => {
  it("centers a box on its anchor", () => {
    expect(centerOn(100, 200, 300, 1000)).toBe(50);
  });

  it("keeps the box inside the start of the viewport", () => {
    expect(centerOn(0, 100, 300, 1000)).toBe(6);
  });

  it("keeps the box inside the end of the viewport", () => {
    expect(centerOn(900, 100, 300, 1000)).toBe(694);
  });

  it("pins boxes wider than the viewport to the start", () => {
    expect(centerOn(100, 100, 1200, 1000)).toBe(6);
  });
});

describe("fitsColumns", () => {
  it("counts the gaps between columns", () => {
    expect(fitsColumns(3, 3 * 100 + 2 * 20, 1, 100, 20)).toBe(true);
    expect(fitsColumns(3, 3 * 100 + 2 * 20 - 1, 1, 100, 20)).toBe(false);
  });

  it("scales with the rem size", () => {
    expect(fitsColumns(2, 336, 16, 10, 1)).toBe(true);
    expect(fitsColumns(2, 336, 17, 10, 1)).toBe(false);
  });
});

describe("placePopover", () => {
  const viewport = { width: 1000, height: 800 };
  const box = { width: 300, height: 200 };
  const anchor = { left: 100, top: 300, width: 200, height: 60 };

  it("opens below the anchor by default", () => {
    expect(placePopover(anchor, box, viewport, false)).toEqual({ left: 50, top: 366 });
  });

  it("opens above when there is no room below", () => {
    const low = { ...anchor, top: 700 };
    expect(placePopover(low, box, viewport, false)).toEqual({ left: 50, top: 494 });
  });

  it("opens to the right, centered on the anchor", () => {
    expect(placePopover(anchor, box, viewport, true)).toEqual({ left: 306, top: 230 });
  });

  it("keeps a side card inside the viewport vertically", () => {
    const high = { ...anchor, top: 0 };
    expect(placePopover(high, box, viewport, true).top).toBe(6);
    const low = { ...anchor, top: 790 };
    expect(placePopover(low, box, viewport, true).top).toBe(594);
  });

  it("opens to the left when the right side is too narrow", () => {
    const edge = { ...anchor, left: 700 };
    expect(placePopover(edge, box, viewport, true)).toEqual({ left: 394, top: 230 });
  });

  it("clears neighbors that the card's height reaches", () => {
    const wideNeighbor = { left: 100, top: 366, width: 400, height: 60 };
    expect(placePopover(anchor, box, viewport, true, [anchor, wideNeighbor])).toEqual({
      left: 506,
      top: 230,
    });
  });

  it("ignores records the card's height does not reach", () => {
    const far = { left: 100, top: 600, width: 600, height: 60 };
    expect(placePopover(anchor, box, viewport, true, [far])).toEqual({ left: 306, top: 230 });
  });

  it("falls back to below when neither side fits", () => {
    const wide = { left: 20, top: 300, width: 960, height: 60 };
    expect(placePopover(wide, box, viewport, true)).toEqual({ left: 350, top: 366 });
  });
});
