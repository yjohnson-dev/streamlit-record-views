import type { Axis, Orientation } from "../../shared/types";

export type StepState = "done" | "current" | "upcoming" | "default";

/** The width, in rem, each step needs to sit in a row. */
export const MIN_STEP_REM = 8.5;

/** Picks the orientation: "auto" is horizontal when every step gets its width. */
export function resolveOrientation(
  orientation: Orientation,
  width: number,
  count: number,
  rem: number
): Axis {
  if (orientation !== "auto") return orientation;
  return width >= count * MIN_STEP_REM * rem ? "horizontal" : "vertical";
}

/** Names a step with its position and progress for assistive technology. */
export function stepLabel(
  index: number,
  count: number,
  state: StepState,
  label: string
): string {
  const progress = { done: "completed", current: "current", upcoming: "upcoming" };
  const place = `Step ${index + 1} of ${count}`;
  return state === "default" ? `${place}: ${label}` : `${place}, ${progress[state]}: ${label}`;
}
