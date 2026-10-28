export const GAP_PX = 6;

/** Whether `count` columns each get at least `column` rem in `width` px. */
export function fitsColumns(
  count: number,
  width: number,
  rem: number,
  column: number,
  gap: number
): boolean {
  return (count * column + Math.max(0, count - 1) * gap) * rem <= width;
}

export function centerOn(
  start: number,
  size: number,
  length: number,
  limit: number,
  gap = GAP_PX
): number {
  const centered = start + (size - length) / 2;
  return Math.max(gap, Math.min(centered, limit - length - gap));
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  left: number;
  top: number;
}

/** Returns the top left of a popover: beside the anchor when asked and it fits, else below or above. */
export function placePopover(
  anchor: Rect,
  box: Size,
  viewport: Size,
  beside: boolean,
  others: Rect[] = [],
  gap = GAP_PX
): { left: number; top: number } {
  if (beside) {
    const top = centerOn(anchor.top, anchor.height, box.height, viewport.height, gap);
    // Clear every record the card's height reaches, not just the anchor, so it never covers one.
    let start = anchor.left;
    let end = anchor.left + anchor.width;
    for (const other of others) {
      if (other.top >= top + box.height || other.top + other.height <= top) continue;
      start = Math.min(start, other.left);
      end = Math.max(end, other.left + other.width);
    }
    if (end + gap + box.width <= viewport.width - gap) return { left: end + gap, top };
    if (start - gap - box.width >= gap) return { left: start - gap - box.width, top };
  }
  const below = anchor.top + anchor.height + gap;
  return {
    left: centerOn(anchor.left, anchor.width, box.width, viewport.width, gap),
    top:
      below + box.height <= viewport.height - gap
        ? below
        : Math.max(gap, anchor.top - box.height - gap),
  };
}
