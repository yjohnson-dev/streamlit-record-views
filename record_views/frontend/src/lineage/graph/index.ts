import { el, remPx } from "../../shared/dom";
import { type LineageData, lineageRenderer } from "../../shared/lineage";
import type { Orientation } from "../../shared/types";
import { nodeCard, resolveOrientation } from "./layout";
import "./style.css";

interface GraphData extends LineageData {
  layers: string[][];
  focus: string | null;
  orientation: Orientation;
}

export default lineageRenderer<GraphData>("Lineage graph", (ctx) => {
  const { data } = ctx;
  const layers = data.layers.map((ids) => ctx.nodes(ids));
  const card = nodeCard(layers.map((nodes) => nodes.length));

  const graph = el(
    "div",
    "lin-graph lin-columns",
    ...layers.map((nodes) =>
      el(
        "div",
        "lin-graph-layer",
        ...nodes.map((node) => {
          const focused = node.id === data.focus;
          const tile = ctx.node(node, { card, meta: "caption", emphasis: focused });
          if (focused) tile.setAttribute("aria-current", "true");
          return tile;
        })
      )
    )
  );
  ctx.connect(graph, { vertical: () => graph.classList.contains("is-vertical") });

  ctx.onResize((width) => {
    const axis = resolveOrientation(data.orientation, layers.length, width, remPx());
    graph.classList.toggle("is-vertical", axis === "vertical");
  });
  return graph;
});
