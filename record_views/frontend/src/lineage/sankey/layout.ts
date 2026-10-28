import type { Axis } from "../../shared/types";

export interface LayoutEntity {
  key: string;
  layer: number;
}

export interface LayoutFlow {
  from: string;
  to: string;
  value: number;
}

/** Where entities and flows go. Positions are along or across the flow direction. */
export interface LayoutOptions {
  /** Space across the flow direction that every column shares. */
  extent: number;
  /** Start of each column's bars along the flow direction. */
  offsets: number[];
  /** A bar's extent along the flow direction. */
  thickness: number;
  /** The least space between neighboring slots. */
  gap: number;
  /** The least space a bar and its label need across the flow direction. */
  minSlot: number;
  /** Where a bar sits in its slot. */
  align: "center" | "start";
}

export interface PlacedNode {
  key: string;
  column: number;
  /** The bar's position along the flow direction. */
  main: number;
  /** The bar's position across it. */
  cross: number;
  /** The bar's extent across it. */
  size: number;
  /** The slot reserved for the bar and its label, across the flow direction. */
  slot: number;
  slotSize: number;
}

export interface PlacedRibbon {
  /** The index of the flow in the input. */
  flow: number;
  from: string;
  to: string;
  thickness: number;
  fromMain: number;
  fromCross: number;
  toMain: number;
  toCross: number;
}

export interface Layout {
  /** Nodes in the order of the input entities. */
  nodes: PlacedNode[];
  /** Ribbons for the flows that can be drawn, in input order. */
  ribbons: PlacedRibbon[];
}

interface Link {
  index: number;
  from: string;
  to: string;
  value: number;
}

interface Slot {
  size: number;
  slotSize: number;
  offset: number;
  pos: number;
}

export const drawable = (flow: LayoutFlow): boolean => flow.value > 0 && flow.from !== flow.to;

const MIN_THICKNESS = 1;
const MIN_BAR = 3;
const SWEEPS = 8;
const RELAXATIONS = 8;

/** Maps each entity key to a column index, compacting the layers. */
export function columnOf(entities: LayoutEntity[]): Map<string, number> {
  const layers = [...new Set(entities.map((entity) => entity.layer))].sort((a, b) => a - b);
  const index = new Map(layers.map((layer, i) => [layer, i]));
  return new Map(entities.map((entity) => [entity.key, index.get(entity.layer)!]));
}

function crossings(columns: string[][], links: Link[], column: Map<string, number>): number {
  const rank = new Map<string, number>();
  for (const keys of columns) keys.forEach((key, i) => rank.set(key, i));
  const groups = new Map<string, Link[]>();
  for (const link of links) {
    const id = `${column.get(link.from)}:${column.get(link.to)}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(link);
  }
  let count = 0;
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const start = rank.get(a.from)! - rank.get(b.from)!;
        const end = rank.get(a.to)! - rank.get(b.to)!;
        if (start * end < 0) count++;
      }
    }
  }
  return count;
}

/** Sorts a column by the weighted mean position of its neighbors in the columns swept so far. */
function reorder(
  columns: string[][],
  index: number,
  links: Link[],
  column: Map<string, number>,
  forward: boolean
): void {
  const position = new Map<string, number>();
  for (const keys of columns) {
    keys.forEach((key, i) => position.set(key, (i + 0.5) / keys.length));
  }
  const mean = (key: string, current: number): number => {
    let weighted = 0;
    let total = 0;
    for (const link of links) {
      const other = forward ? (link.to === key ? link.from : null) : link.from === key ? link.to : null;
      if (other === null) continue;
      const otherColumn = column.get(other)!;
      if (forward ? otherColumn >= index : otherColumn <= index) continue;
      weighted += position.get(other)! * link.value;
      total += link.value;
    }
    return total > 0 ? weighted / total : current;
  };
  const keys = columns[index];
  const scored = keys.map((key, i) => ({ key, i, score: mean(key, position.get(key)!) }));
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  columns[index] = scored.map((item) => item.key);
}

/** Orders the entities of each column to reduce crossing flows. */
function orderColumns(
  columns: string[][],
  links: Link[],
  column: Map<string, number>,
  weight: Map<string, number>
): string[][] {
  const starts = [
    columns.map((keys) => [...keys]),
    columns.map((keys) => [...keys].sort((a, b) => weight.get(b)! - weight.get(a)!)),
  ];
  let best = starts[0];
  let fewest = crossings(best, links, column);
  for (const start of starts) {
    const current = start.map((keys) => [...keys]);
    for (let pass = 0; pass < SWEEPS; pass++) {
      const forward = pass % 2 === 0;
      const order = columns.map((_, i) => i);
      for (const index of forward ? order : order.reverse()) {
        reorder(current, index, links, column, forward);
      }
      const count = crossings(current, links, column);
      if (count < fewest) {
        fewest = count;
        best = current.map((keys) => [...keys]);
      }
    }
  }
  return best;
}

/** Moves slots so none overlap or leave the extent, keeping their order. */
function resolve(slots: Slot[], extent: number, gap: number): void {
  let cursor = 0;
  for (const slot of slots) {
    slot.pos = Math.max(slot.pos, cursor);
    cursor = slot.pos + slot.slotSize + gap;
  }
  let limit = extent;
  for (let i = slots.length - 1; i >= 0; i--) {
    slots[i].pos = Math.min(slots[i].pos, limit - slots[i].slotSize);
    limit = slots[i].pos - gap;
  }
}

interface Graph {
  links: Link[];
  outgoing: Map<string, Link[]>;
  incoming: Map<string, Link[]>;
}

const total = (items: Link[]): number => items.reduce((sum, link) => sum + link.value, 0);

const thick = (value: number, scale: number): number => Math.max(MIN_THICKNESS, value * scale);

const barSize = (graph: Graph, key: string, scale: number): number =>
  Math.max(
    MIN_BAR,
    ...[graph.outgoing, graph.incoming].map((side) =>
      side.get(key)!.reduce((sum, link) => sum + thick(link.value, scale), 0)
    )
  );

function connect(entities: LayoutEntity[], flows: LayoutFlow[], column: Map<string, number>): Graph {
  const links: Link[] = [];
  flows.forEach((flow, index) => {
    if (drawable(flow) && column.has(flow.from) && column.has(flow.to)) {
      links.push({ index, from: flow.from, to: flow.to, value: flow.value });
    }
  });
  const outgoing = new Map(entities.map((entity) => [entity.key, [] as Link[]]));
  const incoming = new Map(entities.map((entity) => [entity.key, [] as Link[]]));
  for (const link of links) {
    outgoing.get(link.from)!.push(link);
    incoming.get(link.to)!.push(link);
  }
  return { links, outgoing, incoming };
}

/** Finds the widest scale, in length per unit of value, at which every column fits the extent. */
function fitScale(columns: string[][], graph: Graph, slotMin: number[], extent: number, gap: number): number {
  if (!graph.links.length) return 0;
  const fits = (scale: number): boolean =>
    columns.every(
      (keys, i) =>
        keys.reduce((sum, key) => sum + Math.max(barSize(graph, key, scale), slotMin[i]), 0) +
          (keys.length - 1) * gap <=
        extent
    );
  let low = 0;
  let high = 1;
  while (fits(high) && high < 1e9) high *= 2;
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}

function placeSlots(
  columns: string[][],
  graph: Graph,
  slotMin: number[],
  scale: number,
  options: LayoutOptions
): Map<string, Slot> {
  const { extent, gap } = options;
  const slots = new Map<string, Slot>();
  columns.forEach((keys, i) => {
    const sizes = keys.map((key) => barSize(graph, key, scale));
    const used = sizes.reduce((sum, size) => sum + Math.max(size, slotMin[i]), 0);
    const step = Math.max(0, extent - used) / (keys.length + 1);
    let cursor = step;
    keys.forEach((key, j) => {
      const slotSize = Math.max(sizes[j], slotMin[i]);
      slots.set(key, {
        size: sizes[j],
        slotSize,
        offset: options.align === "center" ? (slotSize - sizes[j]) / 2 : 0,
        pos: cursor,
      });
      cursor += slotSize + step;
    });
    resolve(keys.map((key) => slots.get(key)!), extent, gap);
  });

  const center = (key: string): number => {
    const slot = slots.get(key)!;
    return slot.pos + slot.offset + slot.size / 2;
  };
  const relax = (index: number, alpha: number, side: Map<string, Link[]>, end: "from" | "to"): void => {
    for (const key of columns[index]) {
      const items = side.get(key)!;
      if (total(items) === 0) continue;
      const wanted = items.reduce((sum, link) => sum + center(link[end]) * link.value, 0) / total(items);
      slots.get(key)!.pos += (wanted - center(key)) * alpha;
    }
    resolve(columns[index].map((key) => slots.get(key)!), extent, gap);
  };
  for (let i = 0; i < RELAXATIONS; i++) {
    const alpha = 0.99 ** i;
    const beta = Math.max(1 - alpha, (i + 1) / RELAXATIONS);
    for (let index = columns.length - 2; index >= 0; index--) relax(index, alpha, graph.outgoing, "to");
    for (let index = 1; index < columns.length; index++) relax(index, beta, graph.incoming, "from");
  }
  return slots;
}

/** Stacks each bar's ribbons without overlap, ordered by where their other ends sit. */
function placeRibbons(
  entities: LayoutEntity[],
  graph: Graph,
  nodes: Map<string, PlacedNode>,
  scale: number,
  thickness: number
): Map<number, PlacedRibbon> {
  const ribbons = new Map<number, PlacedRibbon>();
  for (const link of graph.links) {
    ribbons.set(link.index, {
      flow: link.index,
      from: link.from,
      to: link.to,
      thickness: thick(link.value, scale),
      fromMain: nodes.get(link.from)!.main + thickness,
      fromCross: 0,
      toMain: nodes.get(link.to)!.main,
      toCross: 0,
    });
  }
  const stack = (
    key: string,
    items: Link[],
    other: "from" | "to",
    place: (ribbon: PlacedRibbon, cross: number) => void
  ): void => {
    let cursor = nodes.get(key)!.cross;
    const ends = (link: Link): PlacedNode => nodes.get(link[other])!;
    const sorted = [...items].sort(
      (a, b) => ends(a).cross - ends(b).cross || ends(a).column - ends(b).column || a.index - b.index
    );
    for (const link of sorted) {
      const ribbon = ribbons.get(link.index)!;
      place(ribbon, cursor);
      cursor += ribbon.thickness;
    }
  };
  for (const { key } of entities) {
    stack(key, graph.outgoing.get(key)!, "to", (ribbon, cross) => {
      ribbon.fromCross = cross;
    });
    stack(key, graph.incoming.get(key)!, "from", (ribbon, cross) => {
      ribbon.toCross = cross;
    });
  }
  return ribbons;
}

export function layoutSankey(
  entities: LayoutEntity[],
  flows: LayoutFlow[],
  options: LayoutOptions
): Layout {
  const column = columnOf(entities);
  const graph = connect(entities, flows, column);
  const weight = new Map(
    entities.map(({ key }) => [
      key,
      Math.max(total(graph.outgoing.get(key)!), total(graph.incoming.get(key)!)),
    ])
  );
  const unordered: string[][] = Array.from(
    { length: entities.length ? Math.max(...column.values()) + 1 : 0 },
    () => []
  );
  for (const entity of entities) unordered[column.get(entity.key)!].push(entity.key);
  const columns = orderColumns(unordered, graph.links, column, weight);

  const { extent, gap } = options;
  const slotMin = columns.map((keys) =>
    Math.min(options.minSlot, Math.max(0, (extent - (keys.length - 1) * gap) / keys.length))
  );
  const scale = fitScale(columns, graph, slotMin, extent, gap);
  const slots = placeSlots(columns, graph, slotMin, scale, options);

  const nodes = new Map<string, PlacedNode>();
  columns.forEach((keys, index) => {
    for (const key of keys) {
      const slot = slots.get(key)!;
      nodes.set(key, {
        key,
        column: index,
        main: options.offsets[index] ?? 0,
        cross: slot.pos + slot.offset,
        size: slot.size,
        slot: slot.pos,
        slotSize: slot.slotSize,
      });
    }
  });
  const ribbons = placeRibbons(entities, graph, nodes, scale, options.thickness);
  return {
    nodes: entities.map((entity) => nodes.get(entity.key)!),
    ribbons: graph.links.map((link) => ribbons.get(link.index)!),
  };
}

const round = (value: number): string => String(Math.round(value * 100) / 100);

export function ribbonPath(ribbon: PlacedRibbon, orientation: Axis): string {
  const { fromMain, fromCross, toMain, toCross, thickness } = ribbon;
  const point = (main: number, cross: number): string =>
    orientation === "horizontal"
      ? `${round(main)} ${round(cross)}`
      : `${round(cross)} ${round(main)}`;
  const reach =
    toMain >= fromMain ? (toMain - fromMain) / 2 : (fromMain - toMain) / 2 + 32;
  const curve = (m0: number, c0: number, m1: number, c1: number): string =>
    `C ${point(m0 + reach, c0)}, ${point(m1 - reach, c1)}, ${point(m1, c1)}`;
  const back = (m0: number, c0: number, m1: number, c1: number): string =>
    `C ${point(m1 - reach, c1)}, ${point(m0 + reach, c0)}, ${point(m0, c0)}`;
  return [
    `M ${point(fromMain, fromCross)}`,
    curve(fromMain, fromCross, toMain, toCross),
    `L ${point(toMain, toCross + thickness)}`,
    back(fromMain, fromCross + thickness, toMain, toCross + thickness),
    "Z",
  ].join(" ");
}

/** The theme palette names that entity types take in turn. */
const PALETTE = ["blue", "green", "orange", "violet", "red", "yellow"];

export function typeColors(types: (string | null | undefined)[]): Map<string | null, string> {
  const colors = new Map<string | null, string>();
  let next = 0;
  for (const type of types) {
    const name = type || null;
    if (!colors.has(name)) colors.set(name, name === null ? "gray" : PALETTE[next++ % PALETTE.length]);
  }
  return colors;
}

export interface PlanInput {
  width: number;
  columns: number;
  /** The most entities in any column. */
  tallest: number;
  /** Natural label widths of the first column, the last, and the widest between them. */
  first: number;
  last: number;
  middle: number;
  labelHeight: number;
}

export interface Plan {
  orientation: Axis;
  /** Start of each column's bars along the flow direction. */
  offsets: number[];
  /** The length of the flow direction. */
  span: number;
  /** The space across the flow direction that columns share. */
  extent: number;
  /** Room for each column's label along the flow direction; unbounded when stacked. */
  room: number[];
  minSlot: number;
  gap: number;
  align: "center" | "start";
}

export const BAR = 8;
export const LABEL_GAP = 8;
const MIN_LABEL = 72;
const CHANNEL = 48;
const DROP = 64;
const MIN_PITCH = 160;
const MARGIN_SHARE = 0.26;

/** Chooses left-to-right when every column has room for its labels, otherwise top-to-bottom. */
export function planDiagram(input: PlanInput): Plan {
  const { width, columns, tallest, labelHeight } = input;
  const last = columns - 1;
  const gap = 12;
  const cap = width * MARGIN_SHARE;
  const leading = columns > 1 ? Math.min(input.first, cap) + LABEL_GAP : 0;
  const trailing = Math.min(columns > 1 ? input.last : input.first, cap) + LABEL_GAP;
  const pitch = columns > 1 ? (width - leading - trailing - BAR) / last : 0;
  const between = pitch - BAR - 2 * LABEL_GAP - CHANNEL;
  const fits =
    columns < 2 ||
    (columns === 2 ? pitch >= MIN_PITCH : between >= Math.min(input.middle, MIN_LABEL));
  if (fits) {
    const offsets = Array.from({ length: columns }, (_, i) => leading + i * pitch);
    return {
      orientation: "horizontal",
      offsets,
      span: width,
      extent: Math.max(
        Math.min(Math.max(tallest * 64, 240), 520),
        tallest * (labelHeight + gap)
      ),
      room: offsets.map((_, i) =>
        i === 0 && columns > 1 ? leading - LABEL_GAP : i === last ? trailing - LABEL_GAP : between
      ),
      minSlot: labelHeight,
      gap,
      align: "center",
    };
  }

  const band = labelHeight + LABEL_GAP;
  const offsets: number[] = [];
  let cursor = band;
  for (let i = 0; i < columns; i++) {
    offsets.push(cursor);
    cursor += BAR + DROP + (i > 0 && i < last ? band : 0);
  }
  return {
    orientation: "vertical",
    offsets,
    span: offsets[last] + BAR + band,
    extent: width,
    room: offsets.map(() => Infinity),
    minSlot: Math.min(Math.max(Math.floor((width / Math.max(tallest, 1)) * 0.85), 48), 120),
    gap: 8,
    align: "start",
  };
}
