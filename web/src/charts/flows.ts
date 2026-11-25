/**
 * Group -> outcome flow for a Sankey (owner's choice, 2026-11-25: two columns, clean; the
 * funnel shows the stage gates). Pure data shaping of the deal_outcomes card: one row per
 * group with its won, still-open and lost deals, so each group's band equals its deals.
 */
import type { Row } from "@/api/useCard";
import { toNumber } from "@/lib/format";

export const GATES = [
  "Discovery",
  "Qualified",
  "Proposal",
  "Negotiation",
] as const;
export const OUTCOMES = [
  {
    key: "won",
    label: "Won",
    color: "var(--brand-accent)",
    count: "won",
    amount: "won_usd",
  },
  {
    key: "open",
    label: "Still open",
    color: "var(--chart-neutral-bar)",
    count: "still_open",
    amount: "open_usd",
  },
  {
    key: "lost",
    label: "Lost",
    color: "var(--chart-negative)",
    count: "lost",
    amount: "lost_usd",
  },
] as const;

export type NodeCategory = "source" | "landing" | "outcome";
export interface FlowNode {
  name: string;
  category: NodeCategory;
  color: string;
}
export interface FlowLink {
  source: number;
  target: number;
  value: number;
  color: string;
  amount: number;
}

/** `rows` are one dimension's groups, each with `label` and `color` (lib/groups). */
export function buildOutcomeFlow(rows: Row[]): {
  nodes: FlowNode[];
  links: FlowLink[];
} {
  const n = (v: unknown) => toNumber(v) ?? 0;
  const groups = rows.filter((r) => OUTCOMES.some((o) => n(r[o.count]) > 0));
  const outs = OUTCOMES.filter((o) => groups.some((r) => n(r[o.count]) > 0));
  const nodes: FlowNode[] = [
    ...groups.map((r) => ({
      name: String(r.label),
      category: "source" as const,
      color: String(r.color),
    })),
    ...outs.map((o) => ({
      name: o.label,
      category: "outcome" as const,
      color: o.color,
    })),
  ];
  const links: FlowLink[] = [];
  groups.forEach((r, i) =>
    outs.forEach((o, j) => {
      const value = n(r[o.count]);
      if (value > 0)
        links.push({
          source: i,
          target: groups.length + j,
          value,
          color: String(r.color),
          amount: n(r[o.amount]),
        });
    }),
  );
  return { nodes, links };
}
