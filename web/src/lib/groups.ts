/**
 * "Group by" for the cards that return every grouping in one result (velocity, deal outcomes):
 * the options, how a group reads, and its colour. A colour follows its group; dimensions with
 * more groups than the palette has hues (reps, industries) stay neutral, never cycled.
 */
import type { Row } from "@/api/useCard";
import { cap } from "@/insights/common";

export const DIMENSIONS = {
  segment: { label: "Segment", plural: "segments" },
  lead_source: { label: "Lead source", plural: "channels" },
  rep: { label: "Rep", plural: "reps" },
  team: { label: "Team", plural: "teams" },
  industry: { label: "Industry", plural: "industries" },
} as const;
export type Dimension = keyof typeof DIMENSIONS;
export const isDimension = (v: unknown): v is Dimension =>
  typeof v === "string" && Object.hasOwn(DIMENSIONS, v);

const NEUTRAL = "var(--chart-neutral-bar)";
const TEAM_COLORS: Record<string, string> = {
  smb: "var(--chart-1)",
  mid_market: "var(--chart-7)",
  enterprise: "var(--chart-3)",
  partnerships: "var(--chart-4)",
};
const COLORS: Partial<Record<Dimension, Record<string, string>>> = {
  segment: TEAM_COLORS,
  team: TEAM_COLORS,
  lead_source: {
    inbound: "var(--chart-1)",
    outbound: "var(--chart-2)",
    paid: "var(--chart-3)",
    partner: "var(--chart-4)",
    unknown: "var(--chart-5)",
  },
};

/** Rep and industry names are proper nouns; the other keys are CRM codes. */
const isCode = (d: Dimension) =>
  d === "segment" || d === "lead_source" || d === "team";

/** One dimension's rows, each with `label` (starts a sentence), `inline` (inside one) and `color`. */
export function groupRows(rows: Row[], d: Dimension): Row[] {
  return rows
    .filter((r) => r.dimension === d)
    .map((r) => {
      const key = String(r.grp);
      const label = key === "unknown" || isCode(d) ? cap(key) : key;
      const inline = d === "rep" || key === "smb" ? label : label.toLowerCase();
      return { ...r, label, inline, color: COLORS[d]?.[key] ?? NEUTRAL };
    });
}
