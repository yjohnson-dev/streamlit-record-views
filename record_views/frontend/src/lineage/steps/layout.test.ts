import { describe, expect, it } from "vitest";
import { MIN_STEP_REM, resolveOrientation } from "./layout";

describe("resolveOrientation", () => {
  const rem = 16;
  const row = (count: number) => count * MIN_STEP_REM * rem;

  it("keeps an explicit orientation", () => {
    expect(resolveOrientation("horizontal", 100, 5, rem)).toBe("horizontal");
    expect(resolveOrientation("vertical", 5000, 2, rem)).toBe("vertical");
  });

  it("lays auto out in a row when every step gets its width", () => {
    expect(resolveOrientation("auto", row(5), 5, rem)).toBe("horizontal");
    expect(resolveOrientation("auto", row(5) - 1, 5, rem)).toBe("vertical");
  });

  it("scales with the font size and the step count", () => {
    expect(resolveOrientation("auto", row(5), 6, rem)).toBe("vertical");
    expect(resolveOrientation("auto", row(5), 5, 20)).toBe("vertical");
  });
});
