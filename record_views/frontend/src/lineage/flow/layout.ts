import type { LineageEdge } from "../../shared/lineage";
import { fitsColumns } from "../../shared/position";
import type { Orientation } from "../../shared/types";

/** Minimum width of a stage's column and the gap between columns, in rem. */
export const STAGE_REM = 6.5;
export const STAGE_GAP_REM = 1.25;

/** The container width, in rem, from which stacked stages become lanes. */
export const LANE_REM = 34;

export function isStacked(stages: number, width: number, rem: number): boolean {
  return stages < 2 || !fitsColumns(stages, width, rem, STAGE_REM, STAGE_GAP_REM);
}

/** How the stages sit: as columns, as rows of tracks, or as rows with each stage's label on its own lane. */
export type Mode = "columns" | "stacked" | "lanes";

/** Resolves the orientation and the width to a mode; "horizontal" keeps columns however narrow the width is. */
export function resolveMode(
  orientation: Orientation,
  stages: number,
  width: number,
  rem: number
): Mode {
  const columns =
    orientation === "horizontal" ||
    (orientation === "auto" && !isStacked(stages, width, rem));
  if (columns) return "columns";
  return width >= LANE_REM * rem ? "lanes" : "stacked";
}

export function splitEdges(
  edges: LineageEdge[],
  path: ReadonlySet<string>
): [onPath: LineageEdge[], offPath: LineageEdge[]] {
  const onPath: LineageEdge[] = [];
  const offPath: LineageEdge[] = [];
  for (const edge of edges) {
    (path.has(edge.from) && path.has(edge.to) ? onPath : offPath).push(edge);
  }
  return [onPath, offPath];
}

/** Each document's track, the row it takes in columns or the column it takes stacked. */
export interface Tracks {
  track: Map<string, number>;
  count: number;
}

/** Chains share a track only where their stage spans do not overlap, so an edge that skips stages crosses only empty cells. */
export function assignTracks(stages: string[][], edges: LineageEdge[]): Tracks {
  const stageOf = new Map<string, number>();
  stages.forEach((ids, index) => ids.forEach((id) => stageOf.set(id, index)));
  const order = stages.flat();
  const position = new Map(order.map((id, index) => [id, index]));
  const forward = edges.filter(
    (edge) =>
      !edge.related &&
      stageOf.has(edge.from) &&
      stageOf.has(edge.to) &&
      stageOf.get(edge.from)! < stageOf.get(edge.to)!
  );
  const primary = new Map<string, string>();
  for (const edge of forward) {
    const current = primary.get(edge.to);
    const earlier =
      current === undefined ||
      stageOf.get(edge.from)! < stageOf.get(current)! ||
      (stageOf.get(edge.from) === stageOf.get(current) &&
        position.get(edge.from)! < position.get(current)!);
    if (earlier) primary.set(edge.to, edge.from);
  }
  const children = new Map<string, string[]>();
  for (const [child, parent] of primary) {
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(child);
  }
  // The chain continues to the farthest child, so the longest edge runs straight.
  for (const list of children.values()) {
    list.sort(
      (a, b) => stageOf.get(b)! - stageOf.get(a)! || position.get(a)! - position.get(b)!
    );
  }

  const chains: string[][] = [];
  const placed = new Set<string>();
  for (const start of order) {
    if (placed.has(start)) continue;
    const chain = [start];
    placed.add(start);
    let next = children.get(start)?.find((id) => !placed.has(id));
    while (next !== undefined) {
      chain.push(next);
      placed.add(next);
      next = children.get(next)?.find((id) => !placed.has(id));
    }
    chains.push(chain);
  }

  const spans: [number, number][][] = [];
  const track = new Map<string, number>();
  for (const chain of chains) {
    const first = stageOf.get(chain[0])!;
    const last = stageOf.get(chain[chain.length - 1])!;
    let index = spans.findIndex((taken) =>
      taken.every(([start, end]) => last < start || first > end)
    );
    if (index < 0) index = spans.push([]) - 1;
    spans[index].push([first, last]);
    for (const id of chain) track.set(id, index);
  }
  return { track, count: spans.length };
}
