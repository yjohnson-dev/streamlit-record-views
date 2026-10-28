import type { HoverMode } from "./types";

/** What hovering a card draws above the page: the card at a size, its full content, or nothing. */
export type HoverShows = "nothing" | "sized" | "clipped";

export function hoverShows(mode: HoverMode | undefined, clipped: boolean): HoverShows {
  if (mode === "disabled") return "nothing";
  if (mode) return "sized";
  return clipped ? "clipped" : "nothing";
}
