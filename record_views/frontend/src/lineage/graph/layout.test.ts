import { describe, expect, it } from "vitest";
import {
  COLUMN_REM,
  CROWDED_LAYER,
  GAP_REM,
  nodeCard,
  resolveOrientation,
} from "./layout";

const rem = 16;
const needed = (layers: number): number =>
  (layers * COLUMN_REM + (layers - 1) * GAP_REM) * rem;

describe("resolveOrientation", () => {
  it("honors a forced orientation at any width", () => {
    expect(resolveOrientation("horizontal", 5, 100, rem)).toBe("horizontal");
    expect(resolveOrientation("vertical", 2, 4000, rem)).toBe("vertical");
  });

  it("flows horizontally when every layer gets a column", () => {
    expect(resolveOrientation("auto", 5, needed(5), rem)).toBe("horizontal");
    expect(resolveOrientation("auto", 5, needed(5) - 1, rem)).toBe("vertical");
  });

  it("flows vertically below the width the layer count needs", () => {
    expect(resolveOrientation("auto", 3, 420, rem)).toBe("vertical");
    expect(resolveOrientation("auto", 3, 800, rem)).toBe("horizontal");
  });

  it("flows vertically when there is nothing to connect across layers", () => {
    expect(resolveOrientation("auto", 1, 4000, rem)).toBe("vertical");
    expect(resolveOrientation("auto", 0, 4000, rem)).toBe("vertical");
  });
});

describe("nodeCard", () => {
  it("uses record cards until a layer is crowded", () => {
    expect(nodeCard([1, 3, CROWDED_LAYER])).toBe("record");
    expect(nodeCard([1, CROWDED_LAYER + 1])).toBe("tile");
  });

  it("handles an empty graph", () => {
    expect(nodeCard([])).toBe("record");
  });
});
