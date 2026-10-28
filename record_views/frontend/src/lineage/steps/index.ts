import { el, icon, labeledLine, remPx, titleText } from "../../shared/dom";
import {
  type LineageData,
  lineageRenderer,
  nodeLabel,
  paintColors,
} from "../../shared/lineage";
import type { Axis, Orientation } from "../../shared/types";
import { resolveOrientation, type StepState, stepLabel } from "./layout";
import "./style.css";

interface StepsData extends LineageData {
  steps: string[];
  states: Record<string, StepState>;
  current: string | null;
  orientation: Orientation;
}

export default lineageRenderer<StepsData>("Lineage steps", (ctx) => {
  const { data } = ctx;
  const nodes = ctx.nodes(data.steps);

  const items = nodes.map((node, index) => {
    const state = data.states[node.id] ?? "default";
    const mark = el(
      "span",
      "lin-step-mark",
      state === "done" ? icon(":material/check:") : index + 1
    );
    const rail = el(
      "div",
      "lin-step-rail",
      mark,
      index < nodes.length - 1 ? el("span", "lin-step-line") : null
    );
    const status = node.status
      ? el(
          "div",
          "lin-status lin-step-status card-fade",
          el("span", "lin-dot"),
          el("span", "lin-status-text", node.status)
        )
      : null;
    const body = el(
      "div",
      "lin-step-body",
      el("div", "lin-step-title", titleText(node)),
      labeledLine(node.subtitle, node, "lin-step-subtitle card-fade", "div"),
      status,
      labeledLine(node.caption, node, "lin-step-caption card-fade", "div")
    );

    const step = ctx.bind(el("div", `lin-step is-${state}`, rail, body), node);
    step.setAttribute("aria-label", stepLabel(index, nodes.length, state, nodeLabel(node)));
    if (node.id === data.current) step.setAttribute("aria-current", "step");
    paintColors(step, node);
    if (node.color !== "gray") step.classList.add("has-color");
    return el("li", "lin-steps-item", step);
  });

  const view = el("div", "lin-steps", el("ol", "lin-steps-list", ...items));
  const orient = (value: Axis): void => {
    view.classList.toggle("is-horizontal", value === "horizontal");
    view.classList.toggle("is-vertical", value === "vertical");
  };
  orient(data.orientation === "vertical" ? "vertical" : "horizontal");

  ctx.onResize((width) => {
    orient(resolveOrientation(data.orientation, width, nodes.length, remPx()));
  });
  return view;
}, { vertical: (view) => view.classList.contains("is-vertical") });
