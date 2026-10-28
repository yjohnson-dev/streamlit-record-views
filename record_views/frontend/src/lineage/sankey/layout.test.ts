import { describe, expect, it } from "vitest";
import {
  BAR,
  columnOf,
  type LayoutEntity,
  type LayoutFlow,
  type LayoutOptions,
  layoutSankey,
  planDiagram,
  ribbonPath,
} from "./layout";

const entities: LayoutEntity[] = [
  { key: "atlas", layer: 0 },
  { key: "polymer", layer: 0 },
  { key: "north", layer: 1 },
  { key: "south", layer: 1 },
  { key: "east", layer: 2 },
  { key: "west", layer: 2 },
];

const flows: LayoutFlow[] = [
  { from: "atlas", to: "north", value: 1200 },
  { from: "polymer", to: "north", value: 800 },
  { from: "atlas", to: "south", value: 500 },
  { from: "north", to: "east", value: 900 },
  { from: "north", to: "west", value: 700 },
  { from: "south", to: "west", value: 400 },
];

const options: LayoutOptions = {
  extent: 300,
  offsets: [0, 100, 200],
  thickness: BAR,
  gap: 12,
  minSlot: 32,
  align: "center",
};

const named = (layout: ReturnType<typeof layoutSankey>) =>
  new Map(layout.nodes.map((node) => [node.key, node]));

describe("columnOf", () => {
  it("compacts layers into consecutive columns", () => {
    const column = columnOf([
      { key: "a", layer: 3 },
      { key: "b", layer: 7 },
      { key: "c", layer: 3 },
    ]);
    expect([...column.values()]).toEqual([0, 1, 0]);
  });
});

describe("layoutSankey", () => {
  it("keeps slots apart and inside the extent", () => {
    const layout = layoutSankey(entities, flows, options);
    for (let column = 0; column < 3; column++) {
      const slots = layout.nodes
        .filter((node) => node.column === column)
        .sort((a, b) => a.slot - b.slot);
      expect(slots[0].slot).toBeGreaterThanOrEqual(-1e-9);
      const end = slots[slots.length - 1];
      expect(end.slot + end.slotSize).toBeLessThanOrEqual(options.extent + 1e-9);
      for (let i = 1; i < slots.length; i++) {
        const gap = slots[i].slot - (slots[i - 1].slot + slots[i - 1].slotSize);
        expect(gap).toBeGreaterThanOrEqual(options.gap - 1e-9);
      }
    }
  });

  it("sizes ribbons in proportion to value", () => {
    const layout = layoutSankey(entities, flows, options);
    const [a, b] = layout.ribbons;
    expect(a.thickness / b.thickness).toBeCloseTo(1200 / 800, 6);
  });

  it("sizes each bar to its throughput", () => {
    const layout = layoutSankey(entities, flows, options);
    const nodes = named(layout);
    const scale = layout.ribbons[0].thickness / 1200;
    expect(nodes.get("north")!.size).toBeCloseTo(2000 * scale, 6);
    expect(nodes.get("atlas")!.size).toBeCloseTo(1700 * scale, 6);
  });

  it("stacks ribbons inside their bars without overlap", () => {
    const layout = layoutSankey(entities, flows, options);
    for (const node of layout.nodes) {
      for (const side of ["from", "to"] as const) {
        const spans = layout.ribbons
          .filter((ribbon) => ribbon[side] === node.key)
          .map((ribbon) => {
            const start = side === "from" ? ribbon.fromCross : ribbon.toCross;
            return [start, start + ribbon.thickness];
          })
          .sort((a, b) => a[0] - b[0]);
        for (let i = 0; i < spans.length; i++) {
          expect(spans[i][0]).toBeGreaterThanOrEqual(node.cross - 1e-9);
          expect(spans[i][1]).toBeLessThanOrEqual(node.cross + node.size + 1e-9);
          if (i > 0) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1] - 1e-9);
        }
      }
    }
  });

  it("connects a bar's trailing edge to the next bar's leading edge", () => {
    const layout = layoutSankey(entities, flows, options);
    const [first] = layout.ribbons;
    expect(first.fromMain).toBe(options.offsets[0] + BAR);
    expect(first.toMain).toBe(options.offsets[1]);
  });

  it("orders entities so that flows do not cross", () => {
    const crossed: LayoutEntity[] = [
      { key: "a", layer: 0 },
      { key: "b", layer: 0 },
      { key: "x", layer: 1 },
      { key: "y", layer: 1 },
    ];
    const layout = layoutSankey(
      crossed,
      [
        { from: "a", to: "y", value: 10 },
        { from: "b", to: "x", value: 10 },
      ],
      { ...options, offsets: [0, 100] }
    );
    const nodes = named(layout);
    const forward = nodes.get("a")!.cross < nodes.get("b")!.cross;
    expect(nodes.get("y")!.cross < nodes.get("x")!.cross).toBe(forward);
  });

  it("skips flows that cannot be drawn", () => {
    const layout = layoutSankey(
      entities,
      [
        { from: "atlas", to: "north", value: 0 },
        { from: "atlas", to: "atlas", value: 5 },
        { from: "atlas", to: "missing", value: 5 },
        { from: "atlas", to: "south", value: 5 },
      ],
      options
    );
    expect(layout.ribbons.map((ribbon) => ribbon.flow)).toEqual([3]);
  });

  it("gives entities without flows a minimal bar", () => {
    const layout = layoutSankey(entities, [], options);
    expect(layout.ribbons).toEqual([]);
    expect(layout.nodes.every((node) => node.size > 0)).toBe(true);
  });

  it("returns nothing for no entities", () => {
    expect(layoutSankey([], [], options)).toEqual({ nodes: [], ribbons: [] });
  });

  it("shrinks slots that cannot fit the extent", () => {
    const layout = layoutSankey(entities, flows, { ...options, extent: 60 });
    for (const node of layout.nodes) {
      expect(node.slot).toBeGreaterThanOrEqual(-1e-9);
      expect(node.slot + node.slotSize).toBeLessThanOrEqual(60 + 1e-9);
    }
  });

  it("places flows that run backward or within a column", () => {
    const layout = layoutSankey(
      [
        { key: "customer", layer: 0 },
        { key: "warehouse", layer: 1 },
      ],
      [
        { from: "customer", to: "warehouse", value: 100 },
        { from: "warehouse", to: "customer", value: 60 },
      ],
      { ...options, offsets: [0, 100] }
    );
    expect(layout.ribbons).toHaveLength(2);
    for (const ribbon of layout.ribbons) {
      expect(ribbonPath(ribbon, "horizontal")).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe("ribbonPath", () => {
  const ribbon = {
    flow: 0,
    from: "a",
    to: "b",
    thickness: 10,
    fromMain: 8,
    fromCross: 20,
    toMain: 108,
    toCross: 60,
  };

  it("starts and ends at the ribbon edges", () => {
    const path = ribbonPath(ribbon, "horizontal");
    expect(path.startsWith("M 8 20 C")).toBe(true);
    expect(path).toContain(", 108 60 L 108 70 C");
    expect(path.endsWith(", 8 30 Z")).toBe(true);
  });

  it("swaps axes when vertical", () => {
    expect(ribbonPath(ribbon, "vertical").startsWith("M 20 8 C")).toBe(true);
  });
});

describe("planDiagram", () => {
  const base = { columns: 4, tallest: 3, first: 120, last: 110, middle: 120, labelHeight: 34 };

  it("lays out left to right when there is room", () => {
    const plan = planDiagram({ ...base, width: 1100 });
    expect(plan.orientation).toBe("horizontal");
    expect(plan.offsets).toHaveLength(4);
    expect(plan.offsets[0]).toBeGreaterThanOrEqual(base.first);
    expect(plan.offsets[3] + BAR).toBeLessThan(1100);
  });

  it("lays out top to bottom when columns are too close for labels", () => {
    const plan = planDiagram({ ...base, width: 420 });
    expect(plan.orientation).toBe("vertical");
    expect(plan.extent).toBe(420);
    expect(plan.offsets).toEqual([...plan.offsets].sort((a, b) => a - b));
    expect(plan.span).toBeGreaterThan(plan.offsets[3]);
  });

  it("keeps two columns horizontal in less width", () => {
    const wide = planDiagram({ ...base, columns: 2, width: 520 });
    expect(wide.orientation).toBe("horizontal");
    const narrow = planDiagram({ ...base, columns: 2, width: 300 });
    expect(narrow.orientation).toBe("vertical");
  });

  it("grows the extent with the tallest column", () => {
    const few = planDiagram({ ...base, width: 1100, tallest: 2 });
    const many = planDiagram({ ...base, width: 1100, tallest: 8 });
    expect(many.extent).toBeGreaterThan(few.extent);
    expect(many.extent).toBeLessThanOrEqual(520);
  });
});
