import { fitsColumns } from "../../shared/position";
import type { Axis, Orientation } from "../../shared/types";

/** Minimum width of a layer's column and the gap between columns, in rem. */
export const COLUMN_REM = 9;
export const GAP_REM = 2.5;

/** The most nodes a layer shows as record cards before the graph switches to tile cards. */
export const CROWDED_LAYER = 6;

/** Resolves "auto" to the direction whose layers all get a readable column. */
export function resolveOrientation(
  orientation: Orientation,
  layers: number,
  width: number,
  rem: number
): Axis {
  if (orientation !== "auto") return orientation;
  return layers > 1 && fitsColumns(layers, width, rem, COLUMN_REM, GAP_REM)
    ? "horizontal"
    : "vertical";
}

export function nodeCard(layerSizes: number[]): "record" | "tile" {
  return Math.max(0, ...layerSizes) > CROWDED_LAYER ? "tile" : "record";
}
