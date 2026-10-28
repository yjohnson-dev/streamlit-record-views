import { describe, expect, it } from "vitest";
import { routePath } from "./lineage";

const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
});

describe("routePath", () => {
  it("leaves the right side for a box to the right", () => {
    const path = routePath(box(0, 0, 100, 40), box(200, 100, 300, 140));
    expect(path).toBe("M 100 20 C 150 20, 150 120, 200 120");
  });

  it("leaves the bottom for a box below and to the right when vertical", () => {
    const path = routePath(box(0, 0, 100, 40), box(200, 100, 300, 140), true);
    expect(path).toBe("M 50 40 C 50 70, 250 70, 250 100");
  });

  it("goes straight down between aligned boxes", () => {
    const path = routePath(box(0, 0, 100, 40), box(0, 80, 100, 120));
    expect(path).toBe("M 50 40 C 50 60, 50 60, 50 80");
  });

  it("keeps a minimum bend across a narrow gap", () => {
    const path = routePath(box(0, 0, 100, 40), box(0, 42, 100, 80), true);
    expect(path).toBe("M 50 40 C 50 52, 50 30, 50 42");
  });

  it("leaves the top for a box above when vertical", () => {
    const path = routePath(box(200, 100, 300, 140), box(0, 0, 100, 40), true);
    expect(path).toBe("M 250 100 C 250 70, 50 70, 50 40");
  });

  it("falls back to sides for boxes that overlap vertically", () => {
    const path = routePath(box(0, 0, 100, 40), box(200, 20, 300, 60), true);
    expect(path).toBe("M 100 20 C 150 20, 150 40, 200 40");
  });

  it("bulges out to the right for overlapping boxes", () => {
    const path = routePath(box(0, 0, 100, 40), box(50, 20, 150, 60));
    expect(path).toBe("M 100 20 C 124 20, 174 40, 150 40");
  });
});
