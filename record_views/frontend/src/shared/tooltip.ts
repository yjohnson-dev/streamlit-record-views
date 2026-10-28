import { el, supportsPopover } from "./dom";
import { GAP_PX } from "./position";

const OFFSET_PX = 14;

/** A tooltip that opens beside a point and stays inside the viewport. */
export interface Tooltip {
  element: HTMLElement;
  show(content: HTMLElement[], x: number, y: number): void;
  move(x: number, y: number): void;
  hide(): void;
}

/** Creates a pointer tooltip in the top layer. */
export function createTooltip(): Tooltip {
  const element = el("div", "card-tooltip lin-tip");
  element.setAttribute("popover", "manual");
  element.setAttribute("role", "tooltip");

  const move = (x: number, y: number): void => {
    const box = element.getBoundingClientRect();
    const right = x + OFFSET_PX;
    const left = right + box.width <= window.innerWidth - GAP_PX ? right : x - OFFSET_PX - box.width;
    const below = y + OFFSET_PX;
    const top = below + box.height <= window.innerHeight - GAP_PX ? below : y - OFFSET_PX - box.height;
    element.style.left = `${Math.max(GAP_PX, left)}px`;
    element.style.top = `${Math.max(GAP_PX, top)}px`;
  };
  const hide = (): void => {
    if (supportsPopover && element.matches(":popover-open")) element.hidePopover();
  };
  const show = (content: HTMLElement[], x: number, y: number): void => {
    if (!supportsPopover) return;
    element.replaceChildren(...content);
    if (!element.matches(":popover-open")) element.showPopover();
    move(x, y);
  };
  return { element, show, move, hide };
}
