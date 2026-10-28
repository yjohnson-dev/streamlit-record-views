import type { LineageEdge } from "./lineage";

/** Which links a record highlights: its own, or its whole chain. */
export type HighlightMode = "direct" | "chain";

/** A highlighted edge and the depth of its upstream end, counted in edges from the chain's roots. */
export interface HighlightedEdge {
  edge: LineageEdge;
  depth: number;
}

const touches = (edge: LineageEdge, id: string): boolean => edge.from === id || edge.to === id;

/** Collects the ids reached from the start by following the given neighbors. */
function reach(start: string, next: Map<string, string[]>): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  for (let index = 0; index < queue.length; index++) {
    for (const id of next.get(queue[index]) ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  return seen;
}

function group(edges: LineageEdge[], key: "from" | "to", value: "from" | "to"): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const edge of edges) {
    if (!grouped.has(edge[key])) grouped.set(edge[key], []);
    grouped.get(edge[key])!.push(edge[value]);
  }
  return grouped;
}

/** Gives each edge the longest-path depth of its upstream end; an edge that closes a cycle is ignored for depths. */
function depths(edges: LineageEdge[], first: string): Map<string, number> {
  const out = new Map<string, LineageEdge[]>();
  const heads = new Set<string>();
  const ids = new Set<string>();
  for (const edge of edges) {
    if (!out.has(edge.from)) out.set(edge.from, []);
    out.get(edge.from)!.push(edge);
    heads.add(edge.to);
    ids.add(edge.from).add(edge.to);
  }
  const roots = [...ids].filter((id) => !heads.has(id));
  const starts = [...roots, first, ...ids];
  const state = new Map<string, 1 | 2>();
  const closing = new Set<LineageEdge>();
  const finished: string[] = [];
  for (const start of starts) {
    if (state.has(start) || !ids.has(start)) continue;
    state.set(start, 1);
    const stack: [string, number][] = [[start, 0]];
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const edge = out.get(top[0])?.[top[1]++];
      if (!edge) {
        state.set(top[0], 2);
        finished.push(top[0]);
        stack.pop();
      } else if (state.get(edge.to) === 1) {
        closing.add(edge);
      } else if (!state.has(edge.to)) {
        state.set(edge.to, 1);
        stack.push([edge.to, 0]);
      }
    }
  }
  const depth = new Map<string, number>(finished.map((id) => [id, 0]));
  for (const id of finished.reverse()) {
    for (const edge of out.get(id) ?? []) {
      if (closing.has(edge)) continue;
      depth.set(edge.to, Math.max(depth.get(edge.to)!, depth.get(id)! + 1));
    }
  }
  return depth;
}

/**
 * Finds the edges of a record's whole chain: every edge on a directed path to it or from it,
 * plus the undirected edges that touch it. Undirected edges are not followed.
 */
export function chainEdges(edges: LineageEdge[], id: string): HighlightedEdge[] {
  const directed = edges.filter((edge) => !edge.related);
  const above = reach(id, group(directed, "to", "from"));
  const below = reach(id, group(directed, "from", "to"));
  const chain = directed.filter((edge) => above.has(edge.to) || below.has(edge.from));
  const depth = depths(chain, id);
  const found = new Set(chain);
  return edges.flatMap((edge) => {
    if (found.has(edge)) return [{ edge, depth: depth.get(edge.from)! }];
    return edge.related && touches(edge, id) ? [{ edge, depth: 0 }] : [];
  });
}

/** Finds the edges a record highlights: those that touch it, or its whole chain. */
export function highlightedEdges(
  edges: LineageEdge[],
  id: string,
  mode: HighlightMode
): HighlightedEdge[] {
  if (mode === "chain") return chainEdges(edges, id);
  return edges.filter((edge) => touches(edge, id)).map((edge) => ({ edge, depth: 0 }));
}
