import { el, icon } from "../../shared/dom";
import { type LineageData, lineageRenderer, titleOrId } from "../../shared/lineage";
import "./style.css";

interface TrailData extends LineageData {
  trail: string[];
  focus: string;
}

/** Whether each trail was expanded, by component key. */
const expandedTrails = new Map<string, boolean>();

/** Item indices to hide, in order: downstream from the end, then upstream from the root. */
function hideOrder(count: number, focus: number): number[] {
  const downstream = [];
  for (let i = count - 1; i > focus; i--) downstream.push(i);
  const upstream = [];
  for (let i = 1; i < focus; i++) upstream.push(i);
  return [...downstream, ...upstream];
}

export default lineageRenderer<TrailData>("Lineage trail", (ctx) => {
  const { data } = ctx;
  const list = el("ol", "lin-trail");
  const items: HTMLElement[] = [];
  const focusIndex = Math.max(0, data.trail.indexOf(data.focus));

  const separator = (): HTMLElement => {
    const mark = el("span", "lin-trail-sep", icon(":material/chevron_right:"));
    mark.setAttribute("aria-hidden", "true");
    return mark;
  };

  data.trail.forEach((id, index) => {
    const node = ctx.get(id);
    if (!node) return;
    const item = el("li", "lin-trail-item");
    if (index > 0) {
      const previous = data.trail[index - 1];
      const edge = data.edges.find(
        (e) =>
          (e.from === previous && e.to === id) || (e.from === id && e.to === previous)
      );
      const mark = separator();
      if (edge?.relationship) mark.title = edge.relationship;
      item.append(mark);
    }
    const chip = ctx.node(node, { card: "tile", emphasis: id === data.focus });
    if (id === data.focus) chip.setAttribute("aria-current", "true");
    item.append(chip);
    items.push(item);
    list.append(item);
  });

  const more = (): HTMLElement => {
    const button = el("button", "lin-trail-more", "…");
    button.setAttribute("type", "button");
    return el("li", "lin-trail-item lin-trail-gap", separator(), button);
  };
  const setExpanded = (value: boolean): void => {
    expandedTrails.set(ctx.key, value);
    fit();
  };
  const less = (): HTMLElement => {
    const button = el("button", "lin-trail-more", icon(":material/unfold_less:"));
    button.setAttribute("type", "button");
    button.setAttribute("aria-label", "Collapse the trail");
    button.title = "Collapse";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setExpanded(false);
    });
    return el("li", "lin-trail-item lin-trail-gap", button);
  };

  const fit = (): void => {
    for (const gap of list.querySelectorAll(".lin-trail-gap")) gap.remove();
    for (const item of items) item.hidden = false;
    // A hidden container has no width to fit; the next resize fits it.
    if (list.clientWidth === 0) return;
    const expanded = expandedTrails.get(ctx.key) ?? false;
    list.classList.toggle("is-expanded", expanded);
    if (expanded) {
      list.append(less());
      return;
    }

    // Measure at natural chip widths, so records collapse before titles fade.
    list.classList.add("is-measuring");
    const fits = (): boolean => list.scrollWidth <= list.clientWidth + 1;
    const hidden = new Set<number>();
    for (const index of hideOrder(items.length, focusIndex)) {
      if (fits()) break;
      hidden.add(index);
      items[index].hidden = true;
    }
    list.classList.remove("is-measuring");
    const runs: number[][] = [];
    for (const index of [...hidden].sort((a, b) => a - b)) {
      const run = runs[runs.length - 1];
      if (run && run[run.length - 1] === index - 1) run.push(index);
      else runs.push([index]);
    }
    for (const run of runs) {
      const gap = more();
      const names = run.map((i) => titleOrId(ctx.get(data.trail[i]), data.trail[i]));
      const button = gap.querySelector("button")!;
      button.setAttribute("aria-label", `Show ${run.length} more: ${names.join(", ")}`);
      button.title = names.join(" › ");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        setExpanded(true);
      });
      items[run[0]].before(gap);
    }
  };
  ctx.onResize(fit);
  return el("div", "lin-trail-view", list);
}, { smallLabel: true });
