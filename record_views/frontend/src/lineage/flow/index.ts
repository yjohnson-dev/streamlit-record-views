import { el, icon, remPx } from "../../shared/dom";
import {
  type LineageData,
  type LineageNode,
  lineageRenderer,
  paintColors,
} from "../../shared/lineage";
import type { Orientation } from "../../shared/types";
import { assignTracks, type Mode, resolveMode, splitEdges } from "./layout";
import "./style.css";

interface Stage {
  name: string;
  ids: string[];
}

interface FlowData extends LineageData {
  stages: Stage[];
  focus: string | null;
  path: string[];
  orientation: Orientation;
}

export default lineageRenderer<FlowData>("Document flow", (ctx) => {
  const { data } = ctx;
  const path = new Set(data.path);
  const { track, count } = assignTracks(
    data.stages.map((stage) => stage.ids),
    data.edges
  );

  const tile = (node: LineageNode): HTMLElement => {
    const focused = node.id === data.focus;
    const element = ctx.node(node, { card: "record", meta: "caption", emphasis: focused });
    element.classList.toggle("is-path", path.has(node.id));
    if (focused) element.setAttribute("aria-current", "true");
    return element;
  };

  const heads: HTMLElement[] = [];
  const tiles: [HTMLElement, number][] = [];
  const stage = ({ name, ids }: Stage, index: number): HTMLElement => {
    const nodes = ctx.nodes(ids);
    const lead = nodes.find((node) => node.icon) ?? nodes[0];
    const label = el("span", "lin-flow-name card-fade", name);
    label.title = name;
    const head = el(
      "div",
      "lin-flow-head",
      icon(lead?.icon),
      label,
      el("span", "lin-flow-count", nodes.length)
    );
    if (lead) paintColors(head, lead);
    heads.push(head);
    const elements = nodes.map(tile);
    elements.forEach((element) => tiles.push([element, index]));
    const group = el("div", "lin-flow-stage", head, ...elements);
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", `${name}, ${nodes.length} documents`);
    return group;
  };

  const flow = el("div", "lin-flow lin-columns", ...data.stages.map(stage));
  const vertical = (): boolean => !flow.classList.contains("is-columns");
  if (path.size === 0) {
    ctx.connect(flow, { vertical });
  } else {
    flow.classList.add("has-path");
    // Each layer is prepended, so the path layer goes first to end up on top.
    const [onPath, offPath] = splitEdges(data.edges, path);
    ctx.connect(flow, { edges: onPath, className: "is-path", vertical });
    ctx.connect(flow, { edges: offPath, className: "is-muted", vertical });
  }

  const place = (mode: Mode): void => {
    flow.classList.toggle("is-columns", mode === "columns");
    flow.classList.toggle("is-stacked", mode !== "columns");
    flow.classList.toggle("is-lanes", mode === "lanes");
    const tracks = `repeat(${count}, minmax(5.5rem, 12rem))`;
    flow.style.gridTemplateColumns =
      mode === "columns"
        ? `repeat(${data.stages.length}, minmax(6.5rem, 12rem))`
        : mode === "lanes"
          ? `8.5rem ${tracks}`
          : tracks;
    heads.forEach((head, index) => {
      head.style.gridColumn = mode === "columns" ? `${index + 1}` : mode === "lanes" ? "1" : "1 / -1";
      head.style.gridRow = `${mode === "columns" ? 1 : mode === "lanes" ? index + 1 : 2 * index + 1}`;
    });
    for (const [element, index] of tiles) {
      const lane = track.get(element.dataset.id ?? "") ?? 0;
      element.style.gridColumn = `${mode === "columns" ? index + 1 : mode === "lanes" ? lane + 2 : lane + 1}`;
      element.style.gridRow = `${mode === "columns" ? lane + 2 : mode === "lanes" ? index + 1 : 2 * index + 2}`;
    }
  };

  ctx.onResize((width) => {
    place(resolveMode(data.orientation, data.stages.length, width, remPx()));
  });
  return flow;
});
