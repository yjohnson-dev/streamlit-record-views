import { el, resolveColor, SVG_NS, titleText } from "../../shared/dom";
import { formatNumber, plural } from "../../shared/format";
import {
  type LineageData,
  type LineageEntity,
  type LineageNode,
  lineageRenderer,
} from "../../shared/lineage";
import { markFades } from "../../shared/view";
import {
  BAR,
  columnOf,
  drawable,
  LABEL_GAP,
  layoutSankey,
  type Layout,
  type Plan,
  planDiagram,
  ribbonPath,
  typeColors,
} from "./layout";
import { createTooltip } from "../../shared/tooltip";
import "./style.css";

interface Entity extends LineageEntity {
  layer: number;
}

interface Flow {
  from: string;
  to: string;
  value: number;
  records: string[];
}

interface SankeyData extends LineageData {
  entities: Entity[];
  flows: Flow[];
  unit: string;
}

const PAD_PX = 4;
const FALLBACK_LABEL_HEIGHT_PX = 34;
const MAX_LISTED_RECORDS = 6;
const HIT_PX = 8;

/** The flow's weight with its unit, such as "1,200 Quantity". */
const weight = (value: number, unit: string): string =>
  unit === "Records" ? plural(value, "record") : `${formatNumber(value)} ${unit}`;

function recordValue(node: LineageNode, unit: string): string | null {
  const field = node.fields.find(([label]) => label === unit);
  return field && typeof field[1] === "number" ? formatNumber(field[1]) : null;
}

const row = (label: string, value: string): HTMLElement =>
  el("div", "lin-tip-row", el("span", "lin-tip-muted", label), el("span", "", value));

export default lineageRenderer<SankeyData>("Flows between entities", (ctx) => {
  const { data } = ctx;
  if (!data.entities.length) return el("div", "lin-sankey-empty", "No flows to show.");

  const entities = new Map(data.entities.map((entity) => [entity.key, entity]));
  const column = columnOf(data.entities);
  const columns = Math.max(...column.values()) + 1;
  const flows = data.flows.flatMap((flow, index) =>
    drawable(flow) && entities.has(flow.from) && entities.has(flow.to) ? [{ ...flow, index }] : []
  );
  const totals = new Map(data.entities.map((entity) => [entity.key, { incoming: 0, outgoing: 0 }]));
  for (const flow of flows) {
    totals.get(flow.from)!.outgoing += flow.value;
    totals.get(flow.to)!.incoming += flow.value;
  }
  const colors = typeColors(
    [...data.entities].sort((a, b) => a.layer - b.layer).map((entity) => entity.type)
  );
  const accent = (entity: Entity): string =>
    resolveColor(colors.get(entity.type || null)!).accent;

  const view = el("div", "lin-sankey lin-framed");
  view.style.setProperty("--lin-sankey-gap", `${LABEL_GAP}px`);
  const canvas = el("div", "lin-sankey-canvas");
  const links = document.createElementNS(SVG_NS, "svg");
  links.setAttribute("class", "lin-sankey-links");
  links.setAttribute("aria-hidden", "true");
  const tip = createTooltip();

  const ribbons = new Map<number, SVGPathElement>();
  for (const flow of flows) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "lin-sankey-ribbon");
    path.dataset.flow = String(flow.index);
    path.style.setProperty("--lin-accent", accent(entities.get(flow.from)!));
    ribbons.set(flow.index, path);
    links.append(path);
  }

  const elements = new Map<string, HTMLElement>();
  const labels = new Map<string, HTMLElement>();
  for (const entity of data.entities) {
    const { incoming, outgoing } = totals.get(entity.key)!;
    const total = formatNumber(Math.max(incoming, outgoing));
    const label = el(
      "div",
      "lin-sankey-label",
      el("div", "lin-sankey-name card-fade", entity.name),
      el(
        "div",
        "lin-sankey-meta",
        entity.type ? el("span", "lin-sankey-type card-fade", entity.type) : null,
        el("span", "lin-sankey-total", total)
      )
    );
    const element = el("div", "lin-sankey-entity", el("div", "lin-sankey-bar"), label);
    element.dataset.id = entity.key;
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    element.setAttribute(
      "aria-label",
      [
        entity.name,
        entity.type,
        incoming ? `${weight(incoming, data.unit)} in` : null,
        outgoing ? `${weight(outgoing, data.unit)} out` : null,
      ]
        .filter(Boolean)
        .join(", ")
    );
    element.style.setProperty("--lin-accent", accent(entity));
    elements.set(entity.key, element);
    labels.set(entity.key, label);
    canvas.append(element);
  }

  const summary = el(
    "ul",
    "lin-sankey-sr",
    ...flows.map((flow) =>
      el(
        "li",
        "",
        `${entities.get(flow.from)!.name} to ${entities.get(flow.to)!.name}: ${weight(flow.value, data.unit)}, ${plural(flow.records.length, "record")}`
      )
    )
  );
  const caption = el(
    "div",
    "lin-sankey-caption",
    data.unit === "Records" ? "Width shows the number of records" : `Width shows ${data.unit}`
  );
  canvas.prepend(links);
  view.append(canvas, caption, summary, tip.element);

  const entityTip = (entity: Entity): HTMLElement[] => {
    const { incoming, outgoing } = totals.get(entity.key)!;
    return [
      el("div", "lin-tip-title", entity.name),
      entity.type ? row("Type", entity.type) : null,
      entity.identifier ? row("Identifier", entity.identifier) : null,
      incoming ? row("In", weight(incoming, data.unit)) : null,
      outgoing ? row("Out", weight(outgoing, data.unit)) : null,
    ].filter((part): part is HTMLElement => part !== null);
  };
  const flowTip = (flow: Flow): HTMLElement[] => {
    const records = ctx.nodes(flow.records);
    return [
      el("div", "lin-tip-title", `${entities.get(flow.from)!.name} → ${entities.get(flow.to)!.name}`),
      row("Total", weight(flow.value, data.unit)),
      row("Records", formatNumber(flow.records.length)),
      records.length
        ? el(
            "div",
            "lin-tip-rows",
            ...records
              .slice(0, MAX_LISTED_RECORDS)
              .map((node) => row(`${node.recordType} ${titleText(node)}`, recordValue(node, data.unit) ?? "")),
            records.length > MAX_LISTED_RECORDS
              ? el("div", "lin-tip-muted", `+${records.length - MAX_LISTED_RECORDS} more`)
              : null
          )
        : null,
    ].filter((part): part is HTMLElement => part !== null);
  };

  type Focus = { entity: string } | { flow: number } | null;
  let hovered: Focus = null;
  let selected: string | null = null;
  const paint = (): void => {
    const focus = hovered ?? (selected ? { entity: selected } : null);
    const lit = new Set<number>();
    const connected = new Set<string>();
    if (focus && "flow" in focus) {
      const flow = data.flows[focus.flow];
      lit.add(focus.flow);
      connected.add(flow.from).add(flow.to);
    } else if (focus) {
      connected.add(focus.entity);
      for (const flow of flows) {
        if (flow.from !== focus.entity && flow.to !== focus.entity) continue;
        lit.add(flow.index);
        connected.add(flow.from).add(flow.to);
      }
    }
    view.classList.toggle("has-focus", focus !== null);
    for (const [index, path] of ribbons) path.classList.toggle("is-lit", lit.has(index));
    for (const [key, element] of elements) element.classList.toggle("is-connected", connected.has(key));
  };

  const inspect = (event: Event): void => {
    const target = event.target as Element;
    const ribbon = target.closest<SVGElement>(".lin-sankey-ribbon");
    const entity = target.closest<HTMLElement>(".lin-sankey-entity");
    const box = entity?.getBoundingClientRect();
    const [x, y] =
      event instanceof MouseEvent
        ? [event.clientX, event.clientY]
        : box
          ? [box.left, box.bottom]
          : [0, 0];
    if (ribbon) {
      const flow = Number(ribbon.dataset.flow);
      hovered = { flow };
      tip.show(flowTip(data.flows[flow]), x, y);
    } else if (entity?.dataset.id) {
      hovered = { entity: entity.dataset.id };
      tip.show(entityTip(entities.get(entity.dataset.id)!), x, y);
    } else {
      hovered = null;
      tip.hide();
    }
    paint();
  };
  const leave = (): void => {
    hovered = null;
    tip.hide();
    paint();
  };
  const follow = (event: MouseEvent): void => {
    if (hovered) tip.move(event.clientX, event.clientY);
  };
  const escape = (event: KeyboardEvent): void => {
    if (event.key === "Escape") tip.hide();
  };
  view.addEventListener("mouseover", inspect);
  view.addEventListener("mousemove", follow);
  view.addEventListener("mouseleave", leave);
  view.addEventListener("focusin", inspect);
  view.addEventListener("focusout", leave);
  view.addEventListener("keydown", escape);

  const watcher = new MutationObserver(() => {
    const key = [...elements].find(([, element]) => element.classList.contains("is-selected"))?.[0] ?? null;
    if (key === selected) return;
    selected = key;
    paint();
  });
  watcher.observe(view, { subtree: true, attributes: true, attributeFilter: ["class"] });
  ctx.cleanup(() => {
    watcher.disconnect();
    tip.hide();
  });

  const natural = new Map<string, number>();
  let labelHeight = FALLBACK_LABEL_HEIGHT_PX;
  const measure = (): void => {
    for (const [key, element] of elements) {
      const label = labels.get(key)!;
      element.style.width = "max-content";
      label.style.width = "";
      natural.set(key, label.offsetWidth);
    }
    labelHeight = labels.values().next().value!.offsetHeight || FALLBACK_LABEL_HEIGHT_PX;
  };

  const place = (plan: Plan, layout: Layout, width: number): void => {
    const vertical = plan.orientation === "vertical";
    view.classList.toggle("is-vertical", vertical);
    const height = vertical ? plan.span : plan.extent;
    canvas.style.height = `${height}px`;
    links.setAttribute("width", String(width));
    links.setAttribute("height", String(height));

    for (const node of layout.nodes) {
      const element = elements.get(node.key)!;
      const label = labels.get(node.key)!;
      const before = node.column === 0 && columns > 1;
      element.classList.toggle("is-before", before);
      const bar = element.firstElementChild as HTMLElement;
      if (vertical) {
        const body = labelHeight + LABEL_GAP;
        element.style.left = `${node.slot}px`;
        element.style.top = `${before ? node.main - body : node.main}px`;
        element.style.width = `${node.slotSize}px`;
        element.style.height = `${BAR + body}px`;
        bar.style.width = `${node.size}px`;
        bar.style.height = `${BAR}px`;
        label.style.width = `${node.slotSize}px`;
      } else {
        const room = Math.max(0, Math.min(natural.get(node.key)!, plan.room[node.column]));
        const length = BAR + LABEL_GAP + room;
        element.style.left = `${before ? node.main - LABEL_GAP - room : node.main}px`;
        element.style.top = `${node.slot}px`;
        element.style.width = `${length}px`;
        element.style.height = `${node.slotSize}px`;
        bar.style.width = `${BAR}px`;
        bar.style.height = `${node.size}px`;
        label.style.width = `${room}px`;
      }
    }
    for (const ribbon of layout.ribbons) {
      const path = ribbons.get(ribbon.flow)!;
      path.setAttribute("d", ribbonPath(ribbon, plan.orientation));
      path.style.strokeWidth = `${Math.max(0, HIT_PX - ribbon.thickness)}px`;
    }
  };

  let width = 0;
  const arrange = (next: number): void => {
    width = next - 2 * PAD_PX;
    if (width <= 0) return;
    if (!natural.size) measure();
    const keys = data.entities.map((entity) => entity.key);
    const widths = (wanted: (key: string) => boolean): number =>
      Math.max(0, ...keys.filter(wanted).map((key) => natural.get(key)!));
    const counts = new Array<number>(columns).fill(0);
    for (const key of keys) counts[column.get(key)!]++;
    const plan = planDiagram({
      width,
      columns,
      tallest: Math.max(...counts),
      first: widths((key) => column.get(key) === 0),
      last: widths((key) => column.get(key) === columns - 1),
      middle: widths((key) => column.get(key)! > 0 && column.get(key)! < columns - 1),
      labelHeight,
    });
    const layout = layoutSankey(data.entities, data.flows, {
      extent: plan.extent,
      offsets: plan.offsets,
      thickness: BAR,
      gap: plan.gap,
      minSlot: plan.minSlot,
      align: plan.align,
    });
    place(plan, layout, width);
  };
  ctx.onResize(arrange);
  void document.fonts?.ready.then(() => {
    if (!view.isConnected) return;
    natural.clear();
    arrange(width + 2 * PAD_PX);
    markFades(view);
  });
  return view;
});
