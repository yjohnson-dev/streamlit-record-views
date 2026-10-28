import { adjacency, type LineageEdge } from "../../shared/lineage";

/** A date and optional time of day, as written in an ISO 8601 string. */
export interface Stamp {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
}

/** Records that share a calendar day; `day` is null for undated records. */
export interface DayGroup {
  day: string | null;
  ids: string[];
}

/** How an item relates to the focus. */
export type Role = "focus" | "linked" | "muted";

/** A link from an item to another item, as shown under it. */
export interface ItemLink {
  id: string;
  relationship: string;
  /** Whether the other item came before this one, came after it, or is related. */
  direction: "from" | "to" | "related";
  /** The edge's upstream and downstream ids, in that order. */
  edge: [string, string];
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;
const DIRECTION_ORDER: ItemLink["direction"][] = ["from", "to", "related"];

/** Reads the written date and time of an ISO string, ignoring any offset. */
export function parseIso(iso: string | null | undefined): Stamp | null {
  const match = iso ? ISO_PATTERN.exec(iso) : null;
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: hour === undefined ? null : Number(hour),
    minute: minute === undefined ? null : Number(minute),
  };
}

const dayKey = ({ year, month, day }: Stamp): string =>
  [year, month, day].map((part, i) => String(part).padStart(i ? 2 : 4, "0")).join("-");

/** Splits ids, already in time order, into runs that share a day. */
export function groupByDay(
  ids: string[],
  isoOf: (id: string) => string | null | undefined
): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const id of ids) {
    const stamp = parseIso(isoOf(id));
    const day = stamp ? dayKey(stamp) : null;
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.ids.push(id);
    else groups.push({ day, ids: [id] });
  }
  return groups;
}

/** Formats a day for a group header, such as "Fri, Oct 9, 2026". */
export function formatDay(stamp: Stamp, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(stamp.year, stamp.month - 1, stamp.day));
}

/** Formats a time of day, such as "9:15 AM", or null for a date-only stamp. */
export function formatTime(stamp: Stamp, locale?: string): string | null {
  if (stamp.hour === null || stamp.minute === null) return null;
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(Date.UTC(1970, 0, 1, stamp.hour, stamp.minute));
}

/** Names the focus, the items linked to it, and the rest; empty without a focus. */
export function focusRoles(
  ids: string[],
  edges: LineageEdge[],
  focus: string | null
): Map<string, Role> {
  const roles = new Map<string, Role>();
  if (focus === null) return roles;
  const linked = adjacency(edges).get(focus) ?? new Set<string>();
  for (const id of ids) {
    roles.set(id, id === focus ? "focus" : linked.has(id) ? "linked" : "muted");
  }
  return roles;
}

/** Lists an item's links to items that are not next to it in the list: from, then to, then related. */
export function itemLinks(id: string, edges: LineageEdge[], items: string[]): ItemLink[] {
  const position = items.indexOf(id);
  const links: ItemLink[] = [];
  for (const edge of edges) {
    if (edge.from !== id && edge.to !== id) continue;
    const other = edge.from === id ? edge.to : edge.from;
    if (Math.abs(items.indexOf(other) - position) === 1) continue;
    links.push({
      id: other,
      relationship: edge.relationship,
      direction: edge.related ? "related" : edge.from === id ? "to" : "from",
      edge: [edge.from, edge.to],
    });
  }
  return links.sort(
    (a, b) => DIRECTION_ORDER.indexOf(a.direction) - DIRECTION_ORDER.indexOf(b.direction)
  );
}
