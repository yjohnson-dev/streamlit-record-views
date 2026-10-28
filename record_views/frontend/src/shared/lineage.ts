import type { FrontendRenderer } from "@streamlit/component-v2-lib";
import { type HighlightedEdge, type HighlightMode, highlightedEdges } from "./chain";
import { COMPACT, type Compact } from "./compact";
import { createCard, el, resolveColor, SVG_NS, supportsPopover, titleText } from "./dom";
import { hoverShows } from "./hover";
import { placePopover } from "./position";
import type { CardData, CardVariant, HoverMode, StatusDisplay, ViewData } from "./types";
import { LAYOUTS } from "./variants";
import { type Cleanup, cardView, fitStatus, markFades } from "./view";

/** A record serialized for lineage components: its compact card payload plus lineage fields. */
export interface LineageNode extends Compact, Partial<Pick<ViewData, "border" | "background">> {
  id: string;
  origin?: string | null;
  /** The timestamp in ISO 8601 form, when it is a date or datetime. */
  iso?: string | null;
  /** The record as a card of the onHover size; null when the hover shows no card. */
  hover?: ViewData | null;
}

/** A source or target entity of a record. */
export interface LineageEntity {
  key: string;
  name: string;
  type?: string | null;
  identifier?: string | null;
}

/** A connection from an upstream node to a downstream node. */
export interface LineageEdge {
  from: string;
  to: string;
  relationship: string;
  related: boolean;
}

/** The payload every lineage component receives. */
export interface LineageData {
  nodes: LineageNode[];
  edges: LineageEdge[];
  absent: string;
  selected?: string | null;
  /** Increases each time Python replaces the selection. */
  revision?: number;
  /** Whether clicking a record selects it; true unless on_select is "ignore". */
  selectable?: boolean;
  contentWidth?: boolean;
  /** Whether to frame the whole component with a border. */
  border?: boolean;
  /** Whether to fill the whole component. */
  background?: boolean;
  statusDisplay?: StatusDisplay;
  /** The card_config variant that draws every node; null keeps each layout's own choice. */
  cardVariant?: CardVariant | null;
  /** What hovering a record shows; medium when absent. */
  onHover?: HoverMode;
  /**
   * Which links a hovered, focused, or selected record highlights; null for none.
   * When absent, hovering highlights the record's own links and selection highlights nothing.
   */
  highlightLinks?: HighlightMode | null;
  /** Text shown above the component. */
  label?: string | null;
}

/** How a node renders. */
export interface NodeOptions {
  /** The card that draws the node, compact: a record, tile, property, or ledger card. */
  card?: CardVariant;
  /** The record card's last line when it has no headline: the caption, the subtitle, or nothing. */
  meta?: "caption" | "subtitle" | null;
  /** Whether to emphasize the node, such as the focus record. */
  emphasis?: boolean;
}

/** Which connectors a layer draws, and how. */
export interface ConnectOptions {
  /** The edges to draw; all edges by default. */
  edges?: LineageEdge[];
  /** A class for the layer's SVG element, such as "is-muted". */
  className?: string;
  /** Whether the layout currently stacks its nodes in rows. */
  vertical?: () => boolean;
}

/** Helpers a lineage layout uses to build its view. */
export interface LineageContext<D extends LineageData> {
  data: D;
  /** The component's key, for state that outlives a rerender. */
  key: string;
  get(id: string): LineageNode | undefined;
  nodes(ids: string[]): LineageNode[];
  /** Builds a selectable node element. */
  node(node: LineageNode, options?: NodeOptions): HTMLElement;
  /** Makes an element selectable as the given node, such as an embedded card. */
  bind(element: HTMLElement, node: LineageNode): HTMLElement;
  connect(container: HTMLElement, options?: ConnectOptions): void;
  /** Runs a callback after mounting and whenever the width changes. */
  onResize(callback: (width: number) => void): void;
  /** Registers a function to run when the component unmounts or rerenders. */
  cleanup(fn: Cleanup): void;
}

const DETAIL_DELAY_MS = 450;
let markerCount = 0;
const drawnKeys = new Set<string>();

/** The title of a node, or the id of a record the component was not given. */
export const titleOrId = (node: LineageNode | undefined, id: string): string =>
  node ? titleText(node) : id;

export function nodeLabel(node: LineageNode): string {
  const parts = [`${node.recordType} ${titleText(node)}`];
  if (node.status) parts.push(node.status);
  return parts.join(", ");
}

/** The variant that draws a node: the card_config's, else the layout's own choice. */
export const variantOf = (
  data: Pick<LineageData, "cardVariant">,
  layoutChoice: CardVariant = "record"
): CardVariant => data.cardVariant ?? layoutChoice;

/** The outline and fill of a node; a node draws a border and no background unless told otherwise. */
export function nodeFrame(node: Pick<LineageNode, "border" | "background">): {
  line: string;
  fill: string;
} {
  return {
    line: node.border === false ? "transparent" : "var(--st-border-color)",
    fill: node.background ? "var(--st-secondary-background-color)" : "var(--st-background-color)",
  };
}

/** Draws a node as a compact card of a variant, without selection behavior. */
export function nodeElement(node: LineageNode, options: NodeOptions = {}): HTMLElement {
  const card = options.card ?? "record";
  const meta = options.meta === undefined ? "subtitle" : options.meta;
  const d: LineageNode = {
    ...node,
    disabled: true,
    caption: meta === "caption" ? node.caption : null,
    subtitle: meta === null ? null : node.subtitle,
  };
  const element = createCard(d, card, COMPACT[card](d));
  element.classList.add("lin-node");
  if (card === "tile") element.classList.add("lin-node--chip");
  if (options.emphasis) element.classList.add("is-emphasis");
  paintColors(element, node);
  const { line, fill } = nodeFrame(node);
  element.style.setProperty("--lin-node-line", line);
  element.style.setProperty("--lin-node-fill", fill);
  return element;
}

export function paintColors(
  element: HTMLElement,
  node: Pick<CardData, "color" | "statusColor">
): void {
  element.style.setProperty("--lin-accent", resolveColor(node.color).accent);
  element.style.setProperty("--lin-status", resolveColor(node.statusColor).accent);
}

/** Maps each node id to the ids it connects to, in either direction. */
export function adjacency(edges: LineageEdge[]): Map<string, Set<string>> {
  const linked = new Map<string, Set<string>>();
  const add = (a: string, b: string): void => {
    if (!linked.has(a)) linked.set(a, new Set());
    linked.get(a)!.add(b);
  };
  for (const edge of edges) {
    add(edge.from, edge.to);
    add(edge.to, edge.from);
  }
  return linked;
}

/** A box in container coordinates. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Returns an SVG path from box a to box b; vertical layouts try below and above first. */
export function routePath(a: Box, b: Box, vertical = false): string {
  const ax = (a.left + a.right) / 2;
  const ay = (a.top + a.bottom) / 2;
  const bx = (b.left + b.right) / 2;
  const by = (b.top + b.bottom) / 2;
  const curve = (x1: number, y1: number, c1x: number, c1y: number, c2x: number, c2y: number, x2: number, y2: number): string =>
    `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  const right = (): string | null => {
    if (b.left < a.right - 1) return null;
    const d = Math.max(16, (b.left - a.right) / 2);
    return curve(a.right, ay, a.right + d, ay, b.left - d, by, b.left, by);
  };
  const below = (): string | null => {
    if (b.top < a.bottom - 1) return null;
    const d = Math.max(12, (b.top - a.bottom) / 2);
    return curve(ax, a.bottom, ax, a.bottom + d, bx, b.top - d, bx, b.top);
  };
  const left = (): string | null => {
    if (a.left < b.right - 1) return null;
    const d = Math.max(16, (a.left - b.right) / 2);
    return curve(a.left, ay, a.left - d, ay, b.right + d, by, b.right, by);
  };
  const above = (): string | null => {
    if (a.top < b.bottom - 1) return null;
    const d = Math.max(12, (a.top - b.bottom) / 2);
    return curve(ax, a.top, ax, a.top - d, bx, b.bottom + d, bx, b.bottom);
  };
  for (const route of vertical ? [below, above, right, left] : [right, below, left, above]) {
    const path = route();
    if (path) return path;
  }
  const bulge = 24;
  return curve(a.right, ay, a.right + bulge, ay, b.right + bulge, by, b.right, by);
}

/** Animates a path drawing itself from its upstream end. */
function drawIn(path: SVGPathElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  path.setAttribute("pathLength", "1");
  path.classList.add("is-drawing");
  path.addEventListener(
    "animationend",
    () => {
      path.classList.remove("is-drawing");
      path.removeAttribute("pathLength");
    },
    { once: true }
  );
}

// Stacked dashes of decreasing length, as an SVG gradient cannot follow a curved path.
const BAND_LAYERS = [0.34, 0.27, 0.2, 0.13, 0.06];

/** The time a band takes to cross one edge of a chain, and the pause before the wave starts again. */
export const TRAVEL_MS = 600;
export const PAUSE_MS = 500;

/** Where an edge's band runs in a chain wave, in ms from the start of each loop. */
interface Wave {
  delay: number;
  period: number;
}

/** Adds a highlight band that travels along an active edge from its upstream end. */
function addBand(edge: SVGPathElement, wave?: Wave): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const band = document.createElementNS(SVG_NS, "g");
  band.classList.add("lin-band");
  if (wave) band.classList.add("lin-band--wave");
  for (const length of BAND_LAYERS) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", edge.getAttribute("d") ?? "");
    path.setAttribute("pathLength", "1");
    path.style.setProperty("--band", String(length));
    if (wave) {
      // The same travel as the lin-flow keyframes, parked off the edge outside the edge's turn.
      const from = `${length * 0.5 + 0.2}px`;
      const to = `${length * 0.5 - 1.2}px`;
      const start = wave.delay / wave.period;
      const end = (wave.delay + TRAVEL_MS) / wave.period;
      path.animate(
        [
          { offset: 0, strokeDashoffset: from },
          { offset: start, strokeDashoffset: from },
          { offset: end, strokeDashoffset: to },
          { offset: 1, strokeDashoffset: to },
        ],
        { duration: wave.period, iterations: Infinity }
      );
    }
    band.append(path);
  }
  edge.after(band);
}

/** Removes every band under a node and stops its animations. */
function removeBands(scope: ParentNode): void {
  for (const band of scope.querySelectorAll(".lin-band")) {
    for (const animation of band.getAnimations({ subtree: true })) animation.cancel();
    band.remove();
  }
}

class Connectors {
  private readonly svg: SVGSVGElement;
  private readonly marker: string;

  private animate: boolean;

  constructor(
    readonly container: HTMLElement,
    private readonly edges: LineageEdge[],
    readonly vertical: () => boolean,
    animate: boolean,
    className?: string
  ) {
    this.animate = animate;
    container.classList.add("lin-canvas");
    this.marker = `lin-arrow-${++markerCount}`;
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.classList.add("lin-edges");
    if (className) this.svg.classList.add(className);
    this.svg.setAttribute("aria-hidden", "true");
    const defs = document.createElementNS(SVG_NS, "defs");
    const marker = document.createElementNS(SVG_NS, "marker");
    marker.id = this.marker;
    for (const [name, value] of Object.entries({
      viewBox: "0 0 8 8",
      refX: "7",
      refY: "4",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto-start-reverse",
    })) {
      marker.setAttribute(name, value);
    }
    const tip = document.createElementNS(SVG_NS, "path");
    tip.setAttribute("d", "M 0 0 L 8 4 L 0 8 z");
    tip.classList.add("lin-arrow");
    marker.append(tip);
    defs.append(marker);
    this.svg.append(defs);
    container.prepend(this.svg);
  }

  draw(): void {
    const origin = this.container.getBoundingClientRect();
    this.svg.setAttribute("width", String(this.container.scrollWidth));
    this.svg.setAttribute("height", String(this.container.scrollHeight));
    removeBands(this.svg);
    for (const path of this.svg.querySelectorAll(".lin-edge")) path.remove();
    const dx = this.container.scrollLeft - origin.left;
    const dy = this.container.scrollTop - origin.top;
    const boxes = new Map<string, Box | null>();
    for (const target of this.container.querySelectorAll<HTMLElement>("[data-id]")) {
      const id = target.dataset.id!;
      if (boxes.get(id)) continue;
      if (target.offsetParent === null) {
        boxes.set(id, null);
        continue;
      }
      const rect = target.getBoundingClientRect();
      boxes.set(id, {
        left: rect.left + dx,
        top: rect.top + dy,
        right: rect.right + dx,
        bottom: rect.bottom + dy,
      });
    }
    const box = (id: string): Box | null => boxes.get(id) ?? null;
    const vertical = this.vertical();
    for (const edge of this.edges) {
      const a = box(edge.from);
      const b = box(edge.to);
      if (!a || !b) continue;
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", routePath(a, b, vertical));
      path.classList.add("lin-edge");
      if (edge.related) path.classList.add("is-related");
      else path.setAttribute("marker-end", `url(#${this.marker})`);
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      if (this.animate) drawIn(path);
      this.svg.append(path);
    }
    this.animate = false;
  }
}

/** Copies a clipped node so its content shows in full. */
function unclipped(target: HTMLElement): HTMLElement {
  const copy = target.cloneNode(true) as HTMLElement;
  for (const name of ["data-id", "role", "tabindex", "aria-label", "aria-pressed", "aria-current"]) {
    copy.removeAttribute(name);
  }
  copy.classList.remove("is-active", "is-linked", "is-selected");
  for (const marked of copy.querySelectorAll(".card-overflowing, .card-status-tight")) {
    marked.classList.remove("card-overflowing", "card-status-tight");
  }
  return copy;
}

/** Shows the hovered node as a card, one popover shared by every node. */
function detailPopover(
  root: HTMLElement,
  data: LineageData,
  nodes: Map<string, LineageNode>,
  vertical: () => boolean
): { show(target: HTMLElement): void; hide(): void } {
  const mode = data.onHover === undefined ? "medium" : data.onHover;
  if (!supportsPopover || mode === "disabled") return { show: () => {}, hide: () => {} };
  const variant = variantOf(data);
  const pop = el("div", "card-expansion lin-detail");
  pop.setAttribute("popover", "manual");
  pop.setAttribute("aria-hidden", "true");
  root.append(pop);
  let timer: number | undefined;
  let current: string | null = null;
  let dispose: Cleanup | null = null;
  const hide = (): void => {
    window.clearTimeout(timer);
    current = null;
    if (pop.matches(":popover-open")) pop.hidePopover();
    dispose?.();
    dispose = null;
    pop.replaceChildren();
  };
  // A full-size card embedded in the layout, such as the strip's focus, is not a compact node.
  const embedded = (target: HTMLElement): boolean =>
    target.classList.contains("card") && !target.classList.contains("card-compact");
  const content = (target: HTMLElement, node: LineageNode): HTMLElement | null => {
    const clipped = target.querySelector(".card-overflowing, .card-status-tight") !== null;
    const shows = hoverShows(mode, clipped);
    pop.classList.toggle("lin-detail--natural", shows === "clipped");
    if (shows === "sized" && node.hover) {
      if (embedded(target) && target.classList.contains(`card-${node.hover.size}`)) return null;
      const [card, stop] = cardView(node.hover, variant, LAYOUTS[variant]);
      dispose = stop;
      return card;
    }
    if (shows === "clipped" && !embedded(target)) {
      return target.classList.contains("lin-node")
        ? unclipped(target)
        : nodeElement(node, { card: variant, meta: "caption" });
    }
    return null;
  };
  const show = (target: HTMLElement): void => {
    const id = target.dataset.id ?? null;
    if (id === current) return;
    hide();
    current = id;
    timer = window.setTimeout(() => {
      const node = id ? nodes.get(id) : undefined;
      if (!node || !target.isConnected) return;
      const card = content(target, node);
      if (!card) return;
      const relation = target.dataset.link;
      pop.replaceChildren(...(relation ? [el("div", "lin-detail-relation", relation), card] : [card]));
      pop.showPopover();
      const beside = vertical();
      const others = beside
        ? [...root.querySelectorAll<HTMLElement>("[data-id]")]
            .filter((record) => record.offsetParent !== null)
            .map((record) => record.getBoundingClientRect())
        : [];
      const { left, top } = placePopover(
        target.getBoundingClientRect(),
        pop.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        beside,
        others
      );
      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;
    }, DETAIL_DELAY_MS);
  };
  return { show, hide };
}

const cleanups = new WeakMap<Node, Cleanup>();
const selections = new Map<string, string | null>();
const revisions = new Map<string, number>();

/** How a layout differs from the default. */
export interface RendererOptions {
  /** The label is small text, as for a narrow layout. */
  smallLabel?: boolean;
  /** Whether the layout is a column of records, so a hover card opens beside a record, not over its neighbors. */
  vertical?: boolean | ((view: HTMLElement) => boolean);
}

/** Creates a CCv2 renderer for a lineage layout, which builds its view from the context. */
export function lineageRenderer<D extends LineageData>(
  label: string,
  render: (ctx: LineageContext<D>) => HTMLElement,
  options: RendererOptions = {}
): FrontendRenderer<Record<string, unknown>, D> {
  return ({ data, key, parentElement, setStateValue }) => {
    const root =
      parentElement.querySelector<HTMLElement>(".lineage-root") ??
      (parentElement as HTMLElement);
    if (!root || !data) return;
    cleanups.get(root)?.();
    root.classList.toggle("lineage-root--content", Boolean(data.contentWidth));
    const selectable = data.selectable !== false;
    root.classList.toggle("lineage-root--static", !selectable);
    root.classList.toggle("lineage-root--border", Boolean(data.border));
    root.classList.toggle("lineage-root--background", Boolean(data.background));
    root.classList.toggle("lineage-root--status-dot", data.statusDisplay === "dot");

    const disposers: Cleanup[] = [];
    const resizeCallbacks: ((width: number) => void)[] = [];
    const connectors: Connectors[] = [];
    const nodes = new Map(data.nodes.map((node) => [node.id, node]));

    const bind = (element: HTMLElement, node: LineageNode): HTMLElement => {
      element.dataset.id = node.id;
      element.setAttribute("role", "button");
      element.tabIndex = 0;
      element.setAttribute("aria-label", nodeLabel(node));
      return element;
    };
    const ctx: LineageContext<D> = {
      data,
      key,
      get: (id) => nodes.get(id),
      nodes: (ids) => ids.flatMap((id) => nodes.get(id) ?? []),
      node: (node, options) =>
        bind(nodeElement(node, { ...options, card: variantOf(data, options?.card) }), node),
      bind,
      connect: (container, { edges = data.edges, className, vertical = () => false } = {}) => {
        connectors.push(
          new Connectors(container, edges, vertical, !drawnKeys.has(key), className)
        );
      },
      onResize: (callback) => resizeCallbacks.push(callback),
      cleanup: (fn) => disposers.push(fn),
    };

    const view = render(ctx);
    drawnKeys.add(key);
    view.classList.add("lin-view");
    view.classList.add("lin-framed");
    view.setAttribute("role", "group");
    view.setAttribute("aria-label", data.label || label);
    if (!selectable) {
      for (const target of view.querySelectorAll('[data-id][role="button"]')) {
        target.setAttribute("role", "group");
      }
    }
    const heading = el(
      "div",
      options.smallLabel ? "lin-label lin-label--small" : "lin-label",
      data.label
    );
    root.replaceChildren(...(data.label ? [heading, view] : [view]));

    const given = data.selected ?? null;
    if (!selections.has(key)) selections.set(key, given);
    if ((revisions.get(key) ?? 0) !== (data.revision ?? 0)) {
      // Echo a selection replaced from Python so the next run agrees.
      revisions.set(key, data.revision ?? 0);
      if (selections.get(key) !== given) {
        selections.set(key, given);
        setStateValue("selected", given);
      }
    }
    let selected = selections.get(key) ?? null;
    const paint = (): void => {
      for (const target of root.querySelectorAll<HTMLElement>("[data-id]")) {
        const on = target.dataset.id === selected;
        target.classList.toggle("is-selected", on);
        if (selectable) target.setAttribute("aria-pressed", String(on));
      }
    };
    paint();
    const select = (id: string): void => {
      if (!selectable) return;
      selected = selected === id ? null : id;
      selections.set(key, selected);
      paint();
      refresh();
      setStateValue("selected", selected);
    };

    // Without highlightLinks, a component keeps the older behavior: its own links on hover only.
    const tracked = data.highlightLinks !== undefined;
    const mode = data.highlightLinks === undefined ? "direct" : data.highlightLinks;
    let hovered: string | null = null;
    let lit: { id: string; animated: boolean } | null = null;
    let highlight: HighlightedEdge[] = [];
    const edgeKey = (from: string, to: string, related: boolean): string =>
      `${from}\n${to}\n${related ? 1 : 0}`;
    const paintEdges = (): void => {
      removeBands(root);
      const depths = new Map(
        highlight.map(({ edge, depth }) => [edgeKey(edge.from, edge.to, edge.related), depth])
      );
      const deepest = Math.max(0, ...highlight.filter((h) => !h.edge.related).map((h) => h.depth));
      const period = (deepest + 1) * TRAVEL_MS + PAUSE_MS;
      for (const path of root.querySelectorAll<SVGPathElement>(".lin-edge")) {
        const related = path.classList.contains("is-related");
        const depth = depths.get(edgeKey(path.dataset.from!, path.dataset.to!, related));
        path.classList.toggle("is-active", depth !== undefined);
        if (depth === undefined || related || !lit?.animated) continue;
        addBand(path, mode === "chain" ? { period, delay: depth * TRAVEL_MS } : undefined);
      }
    };
    const refresh = (): void => {
      let next = hovered === null ? null : { id: hovered, animated: true };
      if (next === null && tracked && selected !== null) next = { id: selected, animated: false };
      if (next && (!mode || !nodes.has(next.id))) next = null;
      if (next && !next.animated && !data.edges.some((e) => e.from === next!.id || e.to === next!.id)) {
        next = null;
      }
      if (next?.id === lit?.id && next?.animated === lit?.animated) return;
      lit = next;
      highlight = next && mode ? highlightedEdges(data.edges, next.id, mode) : [];
      const linked = new Set(highlight.flatMap(({ edge }) => [edge.from, edge.to]));
      root.classList.toggle("has-active", next !== null);
      for (const target of root.querySelectorAll<HTMLElement>("[data-id]")) {
        const id = target.dataset.id;
        target.classList.toggle("is-active", next !== null && id === next.id);
        target.classList.toggle("is-linked", next !== null && id !== next.id && linked.has(id ?? ""));
      }
      paintEdges();
    };
    const activate = (id: string | null): void => {
      hovered = id;
      refresh();
    };
    refresh();

    const stacked = (): boolean => {
      const { vertical } = options;
      const declared = typeof vertical === "function" ? vertical(view) : Boolean(vertical);
      return declared || connectors.some((connector) => connector.vertical());
    };
    const detail = detailPopover(root, data, nodes, stacked);
    const nodeAt = (event: Event): HTMLElement | null => {
      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-id]");
      return target && root.contains(target) ? target : null;
    };
    const enter = (event: Event): void => {
      const target = nodeAt(event);
      activate(target?.dataset.id ?? null);
      if (target) detail.show(target);
      else detail.hide();
    };
    const leave = (): void => {
      activate(null);
      detail.hide();
    };
    const click = (event: MouseEvent): void => {
      const target = nodeAt(event);
      if (target?.dataset.id) select(target.dataset.id);
    };
    const keydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        detail.hide();
        return;
      }
      const target = nodeAt(event);
      if (target?.dataset.id && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        select(target.dataset.id);
      }
    };
    root.addEventListener("mouseover", enter);
    root.addEventListener("mouseleave", leave);
    root.addEventListener("focusin", enter);
    root.addEventListener("focusout", leave);
    root.addEventListener("click", click);
    root.addEventListener("keydown", keydown);

    let width = -1;
    const relayout = (force = false): void => {
      const next = root.clientWidth;
      if (force || next !== width) {
        width = next;
        for (const callback of resizeCallbacks) callback(width);
      }
      fitStatus(root.querySelectorAll(".card-compact"));
      markFades(root);
      for (const connector of connectors) connector.draw();
      if (lit !== null) paintEdges();
    };
    const observer = new ResizeObserver(() => relayout());
    observer.observe(root);
    for (const connector of connectors) observer.observe(connector.container);
    void document.fonts?.ready.then(() => {
      if (root.isConnected) relayout(true);
    });

    const cleanup = (): void => {
      observer.disconnect();
      removeBands(root);
      detail.hide();
      root.removeEventListener("mouseover", enter);
      root.removeEventListener("mouseleave", leave);
      root.removeEventListener("focusin", enter);
      root.removeEventListener("focusout", leave);
      root.removeEventListener("click", click);
      root.removeEventListener("keydown", keydown);
      for (const dispose of disposers) dispose();
      cleanups.delete(root);
    };
    cleanups.set(root, cleanup);
    return cleanup;
  };
}
